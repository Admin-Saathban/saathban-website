/* Admin levels, as the database reads them.

   is_admin() treats role admin with no level as support; is_moderator()
   is role admin with level moderator (0125). Kept in its own file so the
   route table and the shell can both import it without importing each
   other. */

export const STAFF = ["support", "super"];
export const ALL_LEVELS = ["moderator", "support", "super"];
export const SUPER = ["super"];

export function levelOf(profile) {
  return profile?.admin_level || "support";
}
