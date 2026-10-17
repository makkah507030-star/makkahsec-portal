export const useSession = () => ({ session: { user: { id: "u" } }, profile: { full_name: "فيصل", role: "teacher" }, adminRoles: [], isTeacher: true, isSuper: true }); export const SessionProvider = ({children}) => children;
export const ROLE_LABEL = {}; export const ADMIN_ROLE_LABEL = {}; export const ASSIGNABLE_ROLES = []; export const ROLE_COVER_HUE = {};
export const coverGradient = () => ""; export const ROLE_PERSON_NAME = {}; export const PERMISSIONS = {};
