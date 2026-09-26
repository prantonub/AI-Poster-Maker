"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const User_1 = require("../../models/User");
const Poster_1 = require("../../models/Poster");
const Template_1 = require("../../models/Template");
const GenerationLog_1 = require("../../models/GenerationLog");
const errorHandler_1 = require("../../middleware/errorHandler");
const settingsService_1 = require("../../services/settingsService");
const router = (0, express_1.Router)();
const DAY_MS = 24 * 60 * 60 * 1000;
function startOfDay(d) {
    const copy = new Date(d);
    copy.setHours(0, 0, 0, 0);
    return copy;
}
function isoDay(d) {
    return d.toISOString().slice(0, 10);
}
// GET /api/admin/stats — dashboard overview (superset of the original stats)
router.get("/stats", (0, errorHandler_1.asyncHandler)(async (_req, res) => {
    const now = new Date();
    const today = startOfDay(now);
    const weekAgo = new Date(today.getTime() - 6 * DAY_MS);
    const [userCount, newUsersToday, newUsersWeek, suspendedUsers, adminCount, posterCounts, posterCountsWeek, templateCount, activeTemplateCount, geminiStats, weekPosterStats, settings,] = await Promise.all([
        User_1.User.countDocuments(),
        User_1.User.countDocuments({ createdAt: { $gte: today } }),
        User_1.User.countDocuments({ createdAt: { $gte: weekAgo } }),
        User_1.User.countDocuments({ isActive: false }),
        User_1.User.countDocuments({ role: "admin" }),
        Poster_1.Poster.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
        Poster_1.Poster.aggregate([
            { $match: { createdAt: { $gte: weekAgo } } },
            { $group: { _id: "$status", count: { $sum: 1 } } },
        ]),
        Template_1.Template.countDocuments(),
        Template_1.Template.countDocuments({ isActive: true }),
        GenerationLog_1.GenerationLog.aggregate([
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    success: { $sum: { $cond: ["$success", 1, 0] } },
                    totalTokens: { $sum: "$tokensUsed" },
                    avgLatencyMs: { $avg: "$latencyMs" },
                },
            },
        ]),
        Poster_1.Poster.aggregate([
            { $match: { createdAt: { $gte: weekAgo } } },
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
                },
            },
        ]),
        (0, settingsService_1.getSettings)(),
    ]);
    const postersByStatus = { draft: 0, generating: 0, completed: 0, failed: 0 };
    for (const row of posterCounts)
        postersByStatus[row._id] = row.count;
    const postersByStatusWeek = { draft: 0, generating: 0, completed: 0, failed: 0 };
    for (const row of posterCountsWeek)
        postersByStatusWeek[row._id] = row.count;
    const gemini = geminiStats[0] ?? { total: 0, success: 0, totalTokens: 0, avgLatencyMs: null };
    const week = weekPosterStats[0] ?? { total: 0, completed: 0 };
    res.json({
        userCount,
        newUsersToday,
        newUsersWeek,
        suspendedUsers,
        adminCount,
        templateCount,
        activeTemplateCount,
        postersByStatus,
        postersByStatusWeek,
        totalPosters: Object.values(postersByStatus).reduce((a, b) => a + b, 0),
        postersThisWeek: week.total,
        completedThisWeek: week.completed,
        geminiCalls: gemini.total,
        geminiSuccessRate: gemini.total > 0 ? Math.round((gemini.success / gemini.total) * 100) : null,
        geminiTokens: gemini.totalTokens ?? 0,
        geminiAvgLatencyMs: gemini.avgLatencyMs ? Math.round(gemini.avgLatencyMs) : null,
        settings,
    });
}));
// GET /api/admin/analytics/timeseries?days=30
router.get("/analytics/timeseries", (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const days = Math.min(90, Math.max(7, parseInt(String(req.query.days ?? "30"), 10) || 30));
    const since = startOfDay(new Date(Date.now() - (days - 1) * DAY_MS));
    const [userSeries, posterSeries, genSeries] = await Promise.all([
        User_1.User.aggregate([
            { $match: { createdAt: { $gte: since } } },
            { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
        ]),
        Poster_1.Poster.aggregate([
            { $match: { createdAt: { $gte: since } } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    total: { $sum: 1 },
                    completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
                    failed: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } },
                },
            },
        ]),
        GenerationLog_1.GenerationLog.aggregate([
            { $match: { createdAt: { $gte: since } } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    total: { $sum: 1 },
                    success: { $sum: { $cond: ["$success", 1, 0] } },
                },
            },
        ]),
    ]);
    // Pre-fill every day in the window so the chart has no gaps.
    const byDay = new Map();
    for (let i = 0; i < days; i += 1) {
        const day = new Date(since.getTime() + i * DAY_MS);
        byDay.set(isoDay(day), {
            newUsers: 0,
            posters: 0,
            completed: 0,
            failed: 0,
            generations: 0,
            generationSuccess: 0,
        });
    }
    for (const row of userSeries) {
        const entry = byDay.get(row._id);
        if (entry)
            entry.newUsers = row.count;
    }
    for (const row of posterSeries) {
        const entry = byDay.get(row._id);
        if (entry) {
            entry.posters = row.total;
            entry.completed = row.completed;
            entry.failed = row.failed;
        }
    }
    for (const row of genSeries) {
        const entry = byDay.get(row._id);
        if (entry) {
            entry.generations = row.total;
            entry.generationSuccess = row.success;
        }
    }
    res.json({
        days,
        series: Array.from(byDay.entries()).map(([date, values]) => ({ date, ...values })),
    });
}));
// GET /api/admin/analytics/top-users?limit=10 — most active creators
router.get("/analytics/top-users", (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? "10"), 10) || 10));
    const rows = await Poster_1.Poster.aggregate([
        {
            $group: {
                _id: "$userId",
                posters: { $sum: 1 },
                completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
                lastPosterAt: { $max: "$createdAt" },
            },
        },
        { $sort: { posters: -1 } },
        { $limit: limit },
        {
            $lookup: {
                from: "users",
                localField: "_id",
                foreignField: "_id",
                as: "user",
            },
        },
        { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
        {
            $project: {
                _id: 0,
                userId: "$_id",
                name: { $ifNull: ["$user.name", "(মুছে ফেলা ব্যবহারকারী)"] },
                email: { $ifNull: ["$user.email", ""] },
                isActive: { $ifNull: ["$user.isActive", false] },
                posters: 1,
                completed: 1,
                lastPosterAt: 1,
            },
        },
    ]);
    res.json(rows);
}));
// GET /api/admin/analytics/occasions — which templates/occasions are used
router.get("/analytics/occasions", (0, errorHandler_1.asyncHandler)(async (_req, res) => {
    const rows = await Poster_1.Poster.aggregate([
        { $group: { _id: "$formData.occasion", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
    ]);
    res.json(rows.map((r) => ({
        occasion: r._id ?? "unknown",
        count: r.count,
    })));
}));
exports.default = router;
