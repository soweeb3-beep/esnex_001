export const getToken = () => sessionStorage.getItem("token");

export const getRole = () => sessionStorage.getItem("role");

export const getName = () => sessionStorage.getItem("name");

export const isLoggedIn = () => Boolean(getToken());

export const logout = () => {
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('role');
  sessionStorage.removeItem('name');
  sessionStorage.removeItem('email');
  sessionStorage.removeItem('userId');
};