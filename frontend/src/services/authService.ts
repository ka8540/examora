import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserSession,
  CognitoUserAttribute, 
} from "amazon-cognito-identity-js";


// ✅ Type-safe environment variables
const poolData = {
  UserPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID as string,
  ClientId: import.meta.env.VITE_COGNITO_CLIENT_ID as string,
};

const userPool = new CognitoUserPool(poolData);

// ✅ Login function
export const login = (email: string, password: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({
      Username: email,
      Pool: userPool,
    });

    const authDetails = new AuthenticationDetails({
      Username: email,
      Password: password,
    });

    user.authenticateUser(authDetails, {
      onSuccess: (result) => {
        const token = (result as CognitoUserSession)
          .getIdToken()
          .getJwtToken();
        localStorage.setItem("examora_token", token);
        resolve(token);
      },
      onFailure: (err) => reject(err),
    });
  });
};

// ✅ Signup function
export const signup = (
  email: string,
  password: string,
  name: string
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const attributeList = [
      new CognitoUserAttribute({
        Name: "name",
        Value: name,
      }),
    ];

    userPool.signUp(email, password, attributeList, [], (err, result) => {
      if (err) reject(err);
      else resolve(result?.user?.getUsername() || "");
    });
  });
};


// ✅ Confirm signup
export const confirmSignup = (email: string, code: string): Promise<string> => {
  const user = new CognitoUser({
    Username: email,
    Pool: userPool,
  });

  return new Promise((resolve, reject) => {
    user.confirmRegistration(code, true, (err, result) => {
      if (err) reject(err);
      else resolve(result || "Success");
    });
  });
};

// ✅ Logout function
export const logout = (): void => {
  const user = userPool.getCurrentUser();
  if (user) user.signOut();
  localStorage.removeItem("examora_token");
};
