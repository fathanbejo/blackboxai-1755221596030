```markdown
# Detailed Plan for Fixing the "Sesi Tidak Valid" Login Issue

## Overview
The login functionality is failing because the session cookie is not being properly set or retained. This issue is likely caused by the session cookie’s domain configuration in the backend (api.php), which prevents the browser from sending the cookie with subsequent requests. We will update the session cookie settings to fix the invalid session error.

## Affected Files and Dependencies
- **api.php**: Handles authentication, session creation, and session persistence.
- **login.js**: Manages form submission and redirect after login.
- **auth-helper.js**: Provides session checking and protection functions.
- **api-helper.js**: Centralizes API calls and error handling.
  
*Note: Ensure that PHP sessions are managed by the DatabaseSessionHandler and that all front-end API calls use `credentials: 'include'`.*

## Step-by-Step Changes

### 1. Update Session Cookie Settings in `api.php`
- **Change 1:** Locate the session initialization block (before any output).
- **Change 2:** Modify the `session_set_cookie_params` call:
  - **Before:**
    ```php
    session_set_cookie_params([
        'lifetime' => 86400,
        'path' => '/',
        'domain' => '',
        'secure' => (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on'),
        'httponly' => true,
        'samesite' => 'Lax'
    ]);
    ```
  - **After:** Replace `'domain' => ''` with:
    ```php
    'domain' => $_SERVER['HTTP_HOST']
    ```
- **Change 3:** (Optional) After `session_regenerate_id(true);` in the login action, add logging (using error_log) to output the new session ID for debugging.
  
### 2. Verify and Confirm in `login.js`
- Ensure that the API call for login (via `apiCall`) correctly uses `credentials: 'include'` (already implemented).
- (Optional) Add a console log after a successful login to confirm user data and that redirection delays are working as expected.
  
### 3. Review and Maintain `auth-helper.js`
- Confirm that the `checkSession()` function leverages the updated session state.
- No code changes are required; ensure that proper session data is cached after login.

### 4. Confirm Error Handling in `api-helper.js`
- Verify that the fetch options include `credentials: 'include'` and that 401 responses redirect to `login.html` as designed.
- Ensure that network errors and malformed JSON responses are logged and handled gracefully.

### 5. Testing and Validation
- Use browser developer tools to confirm that the session cookie (e.g., PHPSESSID) is set with the proper domain.
- Test the login workflow using both valid and invalid credentials.
- Use curl commands to validate responses for login and check_session endpoints.
- Verify that after a successful login the user is redirected to `index.html` and that the session persists for subsequent API calls.

---

**Summary:**
- Update `api.php` to set the session cookie domain to `$_SERVER['HTTP_HOST']`.
- Ensure all API calls include credentials so that cookies are transmitted.
- Confirm that the session is correctly maintained after login and validated through `checkSession()`.
- Verify API error handling in `api-helper.js` remains robust.
- Test the complete login process using browser dev tools and curl commands.
