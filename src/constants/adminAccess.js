export const ADMIN_ACCESS = {
  dev: {
    uid: "3tfmm4f6FDbnmpW4zhPtc5mT9Ps2",
    email: "dateish.office@gmail.com",
    label: "DEV",
  },
  prod: {
    uid: "y7RI2gfS6EcZjeJoVqUunntpCRR2",
    email: "shemzeze@gmail.com",
    label: "PROD",
  },
};

export function getAllowedAdminForEnv(env) {
  return ADMIN_ACCESS[env] || ADMIN_ACCESS.dev;
}

export function isAllowedAdmin(user, env) {
  if (!user) return false;
  const allowed = getAllowedAdminForEnv(env);
  return user.uid === allowed.uid;
}
