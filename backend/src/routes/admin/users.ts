import { Router } from "express";
import mongoose from "mongoose";
import { User, IUser } from "../../models/User";
import { Poster } from "../../models/Poster";
import { GenerationLog } from "../../models/GenerationLog";
import { asyncHandler, ApiError } from "../../middleware/errorHandler";
import { validateBody } from "../../middleware/validate";
import { hashPassword } from "../../services/authService";
import { recordAudit } from "../../services/auditService";
import {
  updateUserSchema,
  setUserRoleSchema,
  setUserStatusSchema,
  setUserPasswordSchema,
  bulkUserActionSchema,
} from "../../schemas/adminSchemas";
import { paginationParams, paginated, str, escapeRegex, dateRange, sortFrom } from "./helpers";

const router = Router();

/** Guards against an admin locking everyone (including themselves) out. */
async function assertNotLastActiveAdmin(target: IUser) {
  if (target.role !== "admin" || !target.isActive) return;
  const activeAdmins = await User.countDocuments({ role: "admin", isActive: true });
  if (activeAdmins <= 1) {
    throw new ApiError(400, "This is the last active admin — promote another admin first.");
  }
}

function assertNotSelf(reqUserId: string, targetId: string, message: string) {
  if (reqUserId === targetId) {
    throw new ApiError(400, message);
  }
}

async function findUserOr404(id: string): Promise<IUser> {
  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError(400, "Invalid user id");
  }
  const user = await User.findById(id);
  if (!user) {
    throw new ApiError(404, "User not found");
  }
  return user;
}

/** Public shape of a user for the admin panel (never includes the hash). */
function toAdminUser(user: IUser, posterCount = 0) {
  return {
    _id: user._id.toString(),
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt ?? null,
    loginCount: user.loginCount,
    posterCount,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

// POST /api/admin/users/bulk — activate / suspend / role change / delete
// (declared before "/:id" so the literal path is never read as an id)
router.post(
  "/bulk",
  validateBody(bulkUserActionSchema),
  asyncHandler(async (req, res) => {
    const { action, ids, reason } = req.body as {
      action: "activate" | "suspend" | "make_admin" | "make_user" | "delete";
      ids: string[];
      reason?: string;
    };

    const selfId = req.user!.sub;
    const skipped: string[] = [];
    let affected = 0;

    for (const id of ids) {
      if (!mongoose.isValidObjectId(id) || id === selfId) {
        // An admin can never lock themselves out mid-session.
        skipped.push(id);
        continue;
      }

      const user = await User.findById(id);
      if (!user) {
        skipped.push(id);
        continue;
      }

      if (action === "suspend" || (action === "make_user" && user.role === "admin")) {
        try {
          await assertNotLastActiveAdmin(user);
        } catch {
          skipped.push(id);
          continue;
        }
      }

      if (action === "activate") {
        user.isActive = true;
      } else if (action === "suspend") {
        user.isActive = false;
      } else if (action === "make_admin") {
        user.role = "admin";
        user.isActive = true;
      } else if (action === "make_user") {
        user.role = "user";
      } else if (action === "delete") {
        await User.deleteOne({ _id: user._id });
        await Poster.deleteMany({ userId: user._id });
        await GenerationLog.deleteMany({ userId: user._id });
        affected += 1;
        continue;
      }

      await user.save();
      affected += 1;
    }

    await recordAudit(req, {
      action: `user.bulk.${action}`,
      entity: "user",
      summary: `${action} applied to ${affected} user(s)`,
      meta: { requested: ids.length, affected, skipped, reason },
    });

    res.json({ affected, skipped });
  })
);

// GET /api/admin/users?search=&role=&status=&from=&to=&sort=&page=&limit=
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = paginationParams(req.query);
    const filter: Record<string, unknown> = {};

    const search = str(req.query.search);
    if (search) {
      const rx = new RegExp(escapeRegex(search), "i");
      filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
    }

    const role = str(req.query.role);
    if (role === "user" || role === "admin") {
      filter.role = role;
    }

    const status = str(req.query.status);
    if (status === "active") filter.isActive = true;
    if (status === "suspended") filter.isActive = false;

    const range = dateRange(req.query, "createdAt");
    if (range) filter.createdAt = range;

    const sort = sortFrom(
      req.query,
      { createdAt: 1, name: 1, email: 1, lastLoginAt: 1, role: 1 },
      { createdAt: -1 }
    );

    const [users, total] = await Promise.all([
      User.find(filter).select("-passwordHash").sort(sort).skip(skip).limit(limit),
      User.countDocuments(filter),
    ]);

    // One aggregation instead of N per-row count queries.
    const counts = await Poster.aggregate([
      { $match: { userId: { $in: users.map((u) => u._id) } } },
      { $group: { _id: "$userId", count: { $sum: 1 } } },
    ]);
    const countByUser = new Map(counts.map((c) => [String(c._id), c.count as number]));

    res.json(
      paginated(
        users.map((u) => toAdminUser(u, countByUser.get(u._id.toString()) ?? 0)),
        page,
        limit,
        total
      )
    );
  })
);

// GET /api/admin/users/:id — full profile + activity snapshot
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const user = await findUserOr404(req.params.id);

    const [posterCount, byStatus, recentPosters] = await Promise.all([
      Poster.countDocuments({ userId: user._id }),
      Poster.aggregate([
        { $match: { userId: user._id } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Poster.find({ userId: user._id })
        .sort({ createdAt: -1 })
        .limit(10)
        .select("formData status generatedImageUrl createdAt"),
    ]);

    res.json({
      ...toAdminUser(user, posterCount),
      postersByStatus: byStatus.reduce<Record<string, number>>((acc, row) => {
        acc[row._id] = row.count;
        return acc;
      }, {}),
      recentPosters,
    });
  })
);

// PATCH /api/admin/users/:id — edit profile fields
router.patch(
  "/:id",
  validateBody(updateUserSchema),
  asyncHandler(async (req, res) => {
    const user = await findUserOr404(req.params.id);
    const { name, email, phone } = req.body as {
      name?: string;
      email?: string;
      phone?: string;
    };

    const before = { name: user.name, email: user.email, phone: user.phone };

    if (name !== undefined) user.name = name;
    if (phone !== undefined) user.phone = phone;

    if (email !== undefined && email !== user.email) {
      const taken = await User.findOne({ email });
      if (taken) throw new ApiError(409, "Another account already uses that email");
      user.email = email;
    }

    await user.save();

    await recordAudit(req, {
      action: "user.update",
      entity: "user",
      entityId: user._id.toString(),
      summary: `Updated profile of ${user.email}`,
      meta: { before, after: { name: user.name, email: user.email, phone: user.phone } },
    });

    res.json(toAdminUser(user));
  })
);

// PATCH /api/admin/users/:id/role
router.patch(
  "/:id/role",
  validateBody(setUserRoleSchema),
  asyncHandler(async (req, res) => {
    const user = await findUserOr404(req.params.id);
    const { role } = req.body as { role: "user" | "admin" };

    if (user.role !== role) {
      if (role === "user") {
        assertNotSelf(req.user!.sub, user._id.toString(), "You cannot demote your own account");
        await assertNotLastActiveAdmin(user);
      }

      const previousRole = user.role;
      user.role = role;
      await user.save();

      await recordAudit(req, {
        action: "user.role.update",
        entity: "user",
        entityId: user._id.toString(),
        summary: `Changed ${user.email} role ${previousRole} → ${role}`,
        meta: { from: previousRole, to: role },
      });
    }

    res.json(toAdminUser(user));
  })
);

// PATCH /api/admin/users/:id/status — suspend / reactivate
router.patch(
  "/:id/status",
  validateBody(setUserStatusSchema),
  asyncHandler(async (req, res) => {
    const user = await findUserOr404(req.params.id);
    const { isActive, reason } = req.body as { isActive: boolean; reason?: string };

    if (user.isActive !== isActive) {
      if (!isActive) {
        assertNotSelf(req.user!.sub, user._id.toString(), "You cannot suspend your own account");
        await assertNotLastActiveAdmin(user);
      }

      user.isActive = isActive;
      await user.save();

      await recordAudit(req, {
        action: isActive ? "user.activate" : "user.suspend",
        entity: "user",
        entityId: user._id.toString(),
        summary: `${isActive ? "Reactivated" : "Suspended"} ${user.email}${reason ? ` — ${reason}` : ""}`,
        meta: { reason },
      });
    }

    res.json(toAdminUser(user));
  })
);

// POST /api/admin/users/:id/password — admin password reset
router.post(
  "/:id/password",
  validateBody(setUserPasswordSchema),
  asyncHandler(async (req, res) => {
    const user = await findUserOr404(req.params.id);
    const { password } = req.body as { password: string };

    user.passwordHash = await hashPassword(password);
    await user.save();

    await recordAudit(req, {
      action: "user.password.reset",
      entity: "user",
      entityId: user._id.toString(),
      summary: `Reset password for ${user.email}`,
    });

    // The new password is never echoed back.
    res.json(toAdminUser(user));
  })
);

// DELETE /api/admin/users/:id — cascades to the user's posters and logs
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const user = await findUserOr404(req.params.id);
    assertNotSelf(req.user!.sub, user._id.toString(), "You cannot delete your own account");
    await assertNotLastActiveAdmin(user);

    const email = user.email;
    const id = user._id;

    await User.deleteOne({ _id: id });
    const [posters, logs] = await Promise.all([
      Poster.deleteMany({ userId: id }),
      GenerationLog.deleteMany({ userId: id }),
    ]);

    await recordAudit(req, {
      action: "user.delete",
      entity: "user",
      entityId: id.toString(),
      summary: `Deleted user ${email} (${posters.deletedCount} posters, ${logs.deletedCount} logs)`,
      meta: { email, postersDeleted: posters.deletedCount, logsDeleted: logs.deletedCount },
    });

    res.json({ deleted: true, postersDeleted: posters.deletedCount, logsDeleted: logs.deletedCount });
  })
);

export default router;
