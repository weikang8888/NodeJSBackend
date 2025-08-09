const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const { ObjectId } = require("mongodb");
const getCrmDb = require("../routes/crm/index");
const getEcommerceDb = require("../routes/ecommerce/index");

// Configure Google OAuth strategy only if credentials are provided
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails[0].value;
          const firstName = profile.name.givenName;
          const lastName = profile.name.familyName;
          const googleId = profile.id;
          const avatar = profile.photos[0].value;

          // The user profile object that will be returned
          const userProfile = {
            googleId,
            email,
            firstName,
            lastName,
            avatar,
            accessToken,
            refreshToken,
          };

          return done(null, userProfile);
        } catch (error) {
          return done(error, null);
        }
      }
    )
  );
} else {
  console.warn("Google OAuth credentials not found. Google authentication will be disabled.");
  console.warn("To enable Google authentication, please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your .env file.");
}

// Helper function to find or create CRM user
async function findOrCreateCrmUser(profile, role = "Member") {
  const db = await getCrmDb();
  const usersCollection = db.collection("users");
  const profileCollection = db.collection("profile");

  // Check if user already exists
  let user = await usersCollection.findOne({
    $or: [{ email: profile.email }, { googleId: profile.googleId }],
  });

  if (user) {
    // Update Google ID if it doesn't exist
    if (!user.googleId) {
      await usersCollection.updateOne(
        { _id: user._id },
        { $set: { googleId: profile.googleId } }
      );
    }
    return user;
  }

  // Create new user
  const userId = new ObjectId();
  
  // Insert user
  await usersCollection.insertOne({
    _id: userId,
    email: profile.email,
    googleId: profile.googleId,
    role: role,
    hasRandomPassword: false,
    isGoogleUser: true,
  });

  // Insert profile
  await profileCollection.insertOne({
    _id: userId,
    email: profile.email,
    firstName: profile.firstName,
    lastName: profile.lastName,
    role: role,
    avatar: profile.avatar,
  });

  // Insert into role-specific collection
  if (role === "Mentor") {
    const mentorsCollection = db.collection("mentors");
    await mentorsCollection.insertOne({
      _id: userId,
      firstName: profile.firstName,
      lastName: profile.lastName,
      avatar: profile.avatar,
      position: "",
      createdAt: new Date().toISOString(),
      email: profile.email,
    });
  } else if (role === "Member") {
    const membersCollection = db.collection("members");
    await membersCollection.insertOne({
      _id: userId,
      firstName: profile.firstName,
      lastName: profile.lastName,
      avatar: profile.avatar,
      position: "",
      createdAt: new Date().toISOString(),
      email: profile.email,
    });
  }

  return await usersCollection.findOne({ _id: userId });
}

// Helper function to find or create Ecommerce user
async function findOrCreateEcommerceUser(profile) {
  const db = await getEcommerceDb();
  const usersCollection = db.collection("users");
  const profileCollection = db.collection("profile");

  // Check if user already exists
  let user = await usersCollection.findOne({
    $or: [{ email: profile.email }, { googleId: profile.googleId }],
  });

  if (user) {
    // Update Google ID if it doesn't exist
    if (!user.googleId) {
      await usersCollection.updateOne(
        { _id: user._id },
        { $set: { googleId: profile.googleId } }
      );
    }
    return user;
  }

  // Create new user with generated username
  const userId = new ObjectId();
  const userName = `google_${profile.googleId}`;

  // Insert user
  await usersCollection.insertOne({
    _id: userId,
    email: profile.email,
    userName: userName,
    googleId: profile.googleId,
    isGoogleUser: true,
  });

  // Insert profile
  await profileCollection.insertOne({
    _id: userId,
    userName: userName,
    email: profile.email,
    firstName: profile.firstName,
    lastName: profile.lastName,
    avatar: profile.avatar,
  });

  return await usersCollection.findOne({ _id: userId });
}

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user);
});

// Deserialize user from session
passport.deserializeUser((user, done) => {
  done(null, user);
});

module.exports = {
  passport,
  findOrCreateCrmUser,
  findOrCreateEcommerceUser,
};
