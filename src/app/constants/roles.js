/* ════════════════════════════════════════════════
   Role constants — SPEC.md, Roles.

   The DB values never change. Display names live HERE and only here:
   "Saath-Fam" is still under review, and renaming it must be a
   one-line edit in this file. Never write a display name inline in a
   component or a locale string — interpolate these values instead.
   ════════════════════════════════════════════════ */

export const ROLE_DISPLAY = {
  saath_icon: "Saath-Icon",
  saath_buddy: "Saath-Buddy",
  family_member: "Saath-Fam", // under review — rename here, nowhere else
  admin: "Admin",
};

// Roles a person can choose at signup. Admin accounts are provisioned
// internally and never self-selected, so there is no admin card.
export const SIGNUP_ROLES = ["saath_icon", "saath_buddy", "family_member"];
