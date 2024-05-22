export function createBirthday(name, birthday, notificationEmails = []) {
  return {
    name,
    birthday: new Date(birthday),
    notificationEmails,
  };
}
