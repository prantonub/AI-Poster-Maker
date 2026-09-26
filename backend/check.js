const m=require("mongoose");
const {connectDB}=require("./dist/config/db");
const {User}=require("./dist/models/User");
(async()=>{
  await connectDB();
  const admins=await User.find({role:"admin"}).select("email isActive").lean();
  let s="ADMIN_COUNT="+admins.length+"\n";
  admins.forEach(function(a){ s+=" - "+a.email+" isActive="+a.isActive+(a.isActive===undefined?" <-- UNDEFINED_BLOCKED":"")+"\n"; });
  s+="MISSING_isActive="+(await User.countDocuments({isActive:{$exists:false}}));
  require("fs").writeFileSync("out.txt",s);
  await m.disconnect();
})();
