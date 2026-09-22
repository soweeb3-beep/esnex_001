# Password Reset and Email Configuration

## Password Reset Flow

The backend supports the following password reset endpoints:

- `POST /api/auth/forgot-password`
  - Request body: `{ email }`
  - Generates a 6-digit PIN and stores it in the user record.
  - If SMTP is configured, the PIN is emailed to the user.
  - If SMTP is not configured, the PIN is still logged to the backend console.

- `POST /api/auth/reset-password`
  - Request body: `{ email, pin, newPassword }`
  - Verifies the PIN and expiry.
  - Hashes and saves the new password.
  - Clears the PIN and expiry.

- `PUT /api/auth/change-password`
  - Request body: `{ currentPassword, newPassword }`
  - Protected route requiring a valid JWT.
  - Verifies current password before saving the new one.

## Email Configuration

To enable sending password reset PIN emails, set the following environment variables in `BACKEND/.env`:

```env
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_USER=your-smtp-username
EMAIL_PASS=your-smtp-password
EMAIL_FROM="ESNEX <no-reply@esnex.com>"
```

- `EMAIL_HOST`: SMTP server hostname.
- `EMAIL_PORT`: SMTP port, usually `587` for TLS or `465` for SSL.
- `EMAIL_USER`: SMTP login username.
- `EMAIL_PASS`: SMTP login password.
- `EMAIL_FROM`: The email address shown as the sender.

If these variables are not configured, the backend will still generate and store the PIN, but it will only be logged in the backend console.

## Testing the Flow

1. Start the backend server:

```powershell
cd "c:\Users\Ebrima Sowe\Desktop\FINAL\EXNEX TECHNOLOGIES CENTER\BACKEND"
npm run dev
```

2. Request a reset PIN:

```powershell
curl -X POST http://localhost:5000/api/auth/forgot-password -H "Content-Type: application/json" -d '{"email":"user@example.com"}'
```

3. Use the PIN to reset the password:

```powershell
curl -X POST http://localhost:5000/api/auth/reset-password -H "Content-Type: application/json" -d '{"email":"user@example.com","pin":"123456","newPassword":"NewPass123!"}'
```

4. Log in with the new password:

```powershell
curl -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" -d '{"email":"user@example.com","password":"NewPass123!"}'
```

## Notes

- PIN expiry is set to 15 minutes.
- The reset PIN is removed after successful password reset.
- The email sender uses `nodemailer`.
