const test = require('node:test');
const assert = require('node:assert/strict');
require('ts-node/register/transpile-only');

const { AuthService } = require('../src/auth.service');

const DATA_GSM_STUDENT = {
  id: 'data-gsm-student-id',
  name: '홍길동',
  email: 'student@gsm.hs.kr',
  grade: 2,
  classNum: 1,
  number: 3,
  studentNumber: 2103,
  major: 'SW_DEVELOPMENT',
  specialty: '백엔드',
  role: 'GENERAL_STUDENT',
};

function createDependencies({
  student = DATA_GSM_STUDENT,
  studentLookupError = null,
  existingAuthUsers = [],
  authUserOverrides = {},
  signupError = null,
  profileExists = true,
} = {}) {
  const signupRequests = [];
  const resendRequests = [];
  const signOutRequests = [];
  const deletedUserIds = [];
  const updatedUserRequests = [];
  const studentLookupEmails = [];
  const user = {
    id: '5e08bc27-2cbd-4a26-a876-733c25de5f09',
    email: 'student@gsm.hs.kr',
    email_confirmed_at: '2026-07-23T00:00:00.000Z',
    created_at: '2026-07-22T00:00:00.000Z',
    user_metadata: { name: '홍길동' },
    ...authUserOverrides,
  };
  const authApi = {
    signUp: async (request) => {
      signupRequests.push(request);
      return {
        data: {
          user,
          session: user.email_confirmed_at
            ? {
                access_token: 'access-token',
                refresh_token: 'refresh-token',
                expires_at: 1234,
              }
            : null,
        },
        error: signupError,
      };
    },
    signInWithPassword: async () => ({
      data: {
        user,
        session: {
          access_token: 'access-token',
          refresh_token: 'refresh-token',
          expires_at: 1234,
        },
      },
      error: null,
    }),
    resend: async (request) => {
      resendRequests.push(request);
      return { data: {}, error: null };
    },
    getUser: async (token) => ({
      data: { user: token === 'access-token' ? user : null },
      error: token === 'access-token' ? null : { message: 'invalid' },
    }),
    admin: {
      signOut: async (token, scope) => {
        signOutRequests.push({ token, scope });
        return { data: null, error: null };
      },
    },
  };
  const supabase = {
    hasAuthConfig: true,
    hasDatabaseConfig: true,
    auth: { auth: authApi },
    db: {
      auth: {
        admin: {
          listUsers: async ({ page, perPage }) => {
            const start = (page - 1) * perPage;
            return {
              data: { users: existingAuthUsers.slice(start, start + perPage) },
              error: null,
            };
          },
          deleteUser: async (userId) => {
            deletedUserIds.push(userId);
            return { error: null };
          },
          updateUserById: async (userId, attributes) => {
            updatedUserRequests.push({ userId, attributes });
            return { data: { user: { ...user, ...attributes } }, error: null };
          },
        },
      },
    },
  };
  const profileSetups = [];
  const profileSnapshots = [];
  const repository = {
    createSignupProfile: async (input) => profileSetups.push(input),
    hasAppProfile: async () => profileExists,
    saveProfileSnapshot: async (userId, input) => {
      profileSnapshots.push({ userId, input });
    },
  };
  const dataGsm = {
    getStudentByEmail: async (email) => {
      studentLookupEmails.push(email);
      if (studentLookupError) throw studentLookupError;
      return student;
    },
  };
  return {
    supabase,
    repository,
    dataGsm,
    profileSetups,
    signupRequests,
    resendRequests,
    signOutRequests,
    deletedUserIds,
    updatedUserRequests,
    studentLookupEmails,
    profileSnapshots,
  };
}

test('signs up a verified-domain account and creates its local profile', async () => {
  const {
    supabase,
    repository,
    dataGsm,
    profileSetups,
    signupRequests,
    studentLookupEmails,
  } = createDependencies();
  const service = new AuthService(supabase, repository, dataGsm);

  const result = await service.signup(
    'Student@GSM.HS.KR',
    'password123',
    '홍 길동',
    2103,
    { terms: true, privacy: true, notifications: false },
  );

  assert.equal(result.status, 'OK');
  assert.equal(result.data.token, 'access-token');
  assert.equal(result.data.session.accessToken, 'access-token');
  assert.equal(profileSetups.length, 1);
  assert.equal(profileSetups[0].studentNumber, 2103);
  assert.equal(profileSetups[0].name, '홍길동');
  assert.equal(profileSetups[0].dataGsmStudentId, 'data-gsm-student-id');
  assert.equal(signupRequests[0].options.data.name, '홍길동');
  assert.deepEqual(studentLookupEmails, ['student@gsm.hs.kr']);
});

test('uses the deployed frontend origin for verification email redirects', async (t) => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousRedirect = process.env.AUTH_EMAIL_REDIRECT_URL;
  const previousOrigins = process.env.CORS_ALLOWED_ORIGINS;
  t.after(() => {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousRedirect === undefined) delete process.env.AUTH_EMAIL_REDIRECT_URL;
    else process.env.AUTH_EMAIL_REDIRECT_URL = previousRedirect;
    if (previousOrigins === undefined) delete process.env.CORS_ALLOWED_ORIGINS;
    else process.env.CORS_ALLOWED_ORIGINS = previousOrigins;
  });

  process.env.NODE_ENV = 'production';
  delete process.env.AUTH_EMAIL_REDIRECT_URL;
  process.env.CORS_ALLOWED_ORIGINS =
    'http://localhost:5173, https://gsm-compass.vercel.app/';

  const { supabase, repository, dataGsm, signupRequests } = createDependencies();
  const service = new AuthService(supabase, repository, dataGsm);

  await service.signup(
    'student@gsm.hs.kr',
    'password123',
    '홍길동',
    2103,
    { terms: true, privacy: true },
  );

  assert.equal(
    signupRequests[0].options.emailRedirectTo,
    'https://gsm-compass.vercel.app/auth/confirmed',
  );
});

test('rejects a student number that is not exactly four digits', async () => {
  const {
    supabase,
    repository,
    dataGsm,
    signupRequests,
    studentLookupEmails,
  } = createDependencies();
  const service = new AuthService(supabase, repository, dataGsm);

  await assert.rejects(
    service.signup(
      'student@gsm.hs.kr',
      'password123',
      '홍길동',
      21031,
      { terms: true, privacy: true },
    ),
    (error) =>
      error.code === 'INVALID_STUDENT_NUMBER' &&
      error.message === '학번은 4자리로 구성됩니다.',
  );

  assert.equal(signupRequests.length, 0);
  assert.equal(studentLookupEmails.length, 0);
});

test('rejects a mismatched student number before creating an auth user', async () => {
  const {
    supabase,
    repository,
    dataGsm,
    signupRequests,
    profileSetups,
  } = createDependencies({
    student: {
      ...DATA_GSM_STUDENT,
      studentNumber: 2201,
    },
  });
  const service = new AuthService(supabase, repository, dataGsm);

  await assert.rejects(
    service.signup(
      'student@gsm.hs.kr',
      'password123',
      '홍길동',
      2103,
      { terms: true, privacy: true },
    ),
    (error) => error.code === 'STUDENT_IDENTITY_MISMATCH',
  );

  assert.equal(signupRequests.length, 0);
  assert.equal(profileSetups.length, 0);
});

test('rejects a mismatched student name before creating an auth user', async () => {
  const {
    supabase,
    repository,
    dataGsm,
    signupRequests,
    profileSetups,
  } = createDependencies();
  const service = new AuthService(supabase, repository, dataGsm);

  await assert.rejects(
    service.signup(
      'student@gsm.hs.kr',
      'password123',
      '다른학생',
      2103,
      { terms: true, privacy: true },
    ),
    (error) => error.code === 'STUDENT_IDENTITY_MISMATCH',
  );

  assert.equal(signupRequests.length, 0);
  assert.equal(profileSetups.length, 0);
});

test('rejects a Data-GSM response with a different email', async () => {
  const {
    supabase,
    repository,
    dataGsm,
    signupRequests,
    profileSetups,
  } = createDependencies({
    student: {
      ...DATA_GSM_STUDENT,
      email: 'another@gsm.hs.kr',
    },
  });
  const service = new AuthService(supabase, repository, dataGsm);

  await assert.rejects(
    service.signup(
      'student@gsm.hs.kr',
      'password123',
      '홍길동',
      2103,
      { terms: true, privacy: true },
    ),
    (error) => error.code === 'STUDENT_IDENTITY_MISMATCH',
  );

  assert.equal(signupRequests.length, 0);
  assert.equal(profileSetups.length, 0);
});

test('rejects a student missing from Data-GSM before creating an auth user', async () => {
  const {
    supabase,
    repository,
    dataGsm,
    signupRequests,
    profileSetups,
  } = createDependencies({ student: null });
  const service = new AuthService(supabase, repository, dataGsm);

  await assert.rejects(
    service.signup(
      'student@gsm.hs.kr',
      'password123',
      '홍길동',
      2103,
      { terms: true, privacy: true },
    ),
    (error) => error.code === 'STUDENT_IDENTITY_MISMATCH',
  );

  assert.equal(signupRequests.length, 0);
  assert.equal(profileSetups.length, 0);
});

test('fails closed when Data-GSM student validation is unavailable', async () => {
  const providerError = Object.assign(new Error('provider unavailable'), {
    code: 'DATA_PROVIDER_UNAVAILABLE',
  });
  const {
    supabase,
    repository,
    dataGsm,
    signupRequests,
    profileSetups,
  } = createDependencies({ studentLookupError: providerError });
  const service = new AuthService(supabase, repository, dataGsm);

  await assert.rejects(
    service.signup(
      'student@gsm.hs.kr',
      'password123',
      'Test Student',
      2103,
      { terms: true, privacy: true },
    ),
    providerError,
  );

  assert.equal(signupRequests.length, 0);
  assert.equal(profileSetups.length, 0);
});

test('rejects a non-GSM email before calling the auth provider', async () => {
  const { supabase, repository, dataGsm, studentLookupEmails } =
    createDependencies();
  const service = new AuthService(supabase, repository, dataGsm);

  await assert.rejects(
    service.signup(
      'student@example.com',
      'password123',
      '홍길동',
      2103,
      { terms: true, privacy: true },
    ),
    (error) => error.code === 'INVALID_SCHOOL_EMAIL',
  );
  assert.equal(studentLookupEmails.length, 0);
});

test('logs in and verifies the Supabase access token', async () => {
  const { supabase, repository, dataGsm } = createDependencies();
  const service = new AuthService(supabase, repository, dataGsm);

  const login = await service.login('student@gsm.hs.kr', 'password123');
  const verified = await service.verifyAccessToken('access-token');
  const rejected = await service.verifyAccessToken('tampered');

  assert.equal(login.data.session.accessToken, 'access-token');
  assert.deepEqual(verified, {
    id: '5e08bc27-2cbd-4a26-a876-733c25de5f09',
    email: 'student@gsm.hs.kr',
  });
  assert.equal(rejected, null);
});

test('synchronizes the canonical Data-GSM identity during login', async () => {
  const {
    supabase,
    repository,
    dataGsm,
    profileSnapshots,
    updatedUserRequests,
  } = createDependencies({
    authUserOverrides: {
      user_metadata: { name: '첫 가입 이름', retained: true },
    },
  });
  const service = new AuthService(supabase, repository, dataGsm);

  const result = await service.login('student@gsm.hs.kr', 'password123');

  assert.equal(result.data.user.name, '홍길동');
  assert.equal(profileSnapshots.length, 1);
  assert.equal(profileSnapshots[0].input.name, '홍길동');
  assert.equal(profileSnapshots[0].input.studentNumber, 2103);
  assert.deepEqual(updatedUserRequests, [
    {
      userId: '5e08bc27-2cbd-4a26-a876-733c25de5f09',
      attributes: {
        user_metadata: {
          name: '홍길동',
          retained: true,
        },
      },
    },
  ]);
});

test('removes an orphaned Auth user when its app profile is missing at login', async () => {
  const { supabase, repository, dataGsm, deletedUserIds } =
    createDependencies({ profileExists: false });
  const service = new AuthService(supabase, repository, dataGsm);

  await assert.rejects(
    service.login('student@gsm.hs.kr', 'password123'),
    (error) =>
      error.code === 'ACCOUNT_REMOVED' &&
      error.getStatus() === 410,
  );
  assert.deepEqual(deletedUserIds, [
    '5e08bc27-2cbd-4a26-a876-733c25de5f09',
  ]);
});

test('removes an orphaned Auth user while verifying a stored access token', async () => {
  const { supabase, repository, dataGsm, deletedUserIds } =
    createDependencies({ profileExists: false });
  const service = new AuthService(supabase, repository, dataGsm);

  const result = await service.verifyAccessToken('access-token');

  assert.equal(result, null);
  assert.deepEqual(deletedUserIds, [
    '5e08bc27-2cbd-4a26-a876-733c25de5f09',
  ]);
});

test('revokes the current Supabase session during logout', async () => {
  const { supabase, repository, dataGsm, signOutRequests } =
    createDependencies();
  const service = new AuthService(supabase, repository, dataGsm);

  await service.logout('access-token');

  assert.deepEqual(signOutRequests, [
    { token: 'access-token', scope: 'local' },
  ]);
});

test('maps a Supabase logout failure to a safe provider error', async () => {
  const { supabase, repository, dataGsm } = createDependencies();
  supabase.auth.auth.admin.signOut = async () => ({
    data: null,
    error: { message: 'sensitive upstream failure' },
  });
  const service = new AuthService(supabase, repository, dataGsm);

  await assert.rejects(
    service.logout('access-token'),
    (error) =>
      error.code === 'AUTH_PROVIDER_UNAVAILABLE' &&
      !error.message.includes('sensitive upstream failure'),
  );
});

test('compensates a failed profile provisioning by removing the new auth user', async () => {
  const { supabase, dataGsm, deletedUserIds } = createDependencies();
  const expectedError = new Error('safe repository failure');
  const service = new AuthService(supabase, {
    createSignupProfile: async () => {
      throw expectedError;
    },
  }, dataGsm);

  await assert.rejects(
    service.signup(
      'student@gsm.hs.kr',
      'password123',
      '홍길동',
      2103,
      { terms: true, privacy: true },
    ),
    expectedError,
  );
  assert.deepEqual(deletedUserIds, [
    '5e08bc27-2cbd-4a26-a876-733c25de5f09',
  ]);
});

test('returns verification timing metadata for a new unconfirmed account', async () => {
  const { supabase, repository, dataGsm } = createDependencies({
    authUserOverrides: {
      email_confirmed_at: null,
      created_at: new Date().toISOString(),
    },
  });
  const service = new AuthService(supabase, repository, dataGsm);

  const result = await service.signup(
    'student@gsm.hs.kr',
    'password123',
    '홍길동',
    2103,
    { terms: true, privacy: true },
  );

  assert.equal(result.data.token, null);
  assert.equal(result.data.verificationRequired, true);
  assert.ok(Date.parse(result.data.verificationExpiresAt) > Date.now());
  assert.ok(Date.parse(result.data.resendAvailableAt) > Date.now());
  assert.ok(Date.parse(result.data.accountExpiresAt) > Date.now());
});

test('preserves the verification email rate limit response from Supabase', async () => {
  const { supabase, repository, dataGsm, profileSetups } = createDependencies({
    signupError: {
      status: 429,
      message: 'email rate limit exceeded',
    },
  });
  const service = new AuthService(supabase, repository, dataGsm);

  await assert.rejects(
    service.signup(
      'student@gsm.hs.kr',
      'password123',
      '홍길동',
      2103,
      { terms: true, privacy: true },
    ),
    (error) =>
      error.code === 'VERIFICATION_EMAIL_RATE_LIMITED' &&
      error.getStatus() === 429,
  );
  assert.equal(profileSetups.length, 0);
});

test('keeps a recent unconfirmed account available without signing up twice', async () => {
  const createdAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const existingUser = {
    id: 'pending-user-id',
    email: 'student@gsm.hs.kr',
    email_confirmed_at: null,
    created_at: createdAt,
  };
  const {
    supabase,
    repository,
    dataGsm,
    signupRequests,
    profileSetups,
  } = createDependencies({ existingAuthUsers: [existingUser] });
  const service = new AuthService(supabase, repository, dataGsm);

  const result = await service.signup(
    'student@gsm.hs.kr',
    'password123',
    '홍길동',
    2103,
    { terms: true, privacy: true },
  );

  assert.equal(result.data.user.id, 'pending-user-id');
  assert.equal(result.data.verificationRequired, true);
  assert.equal(signupRequests.length, 0);
  assert.equal(profileSetups.length, 0);
});

test('removes an orphaned pending Auth user and creates a complete account', async () => {
  const existingUser = {
    id: 'orphaned-user-id',
    email: 'student@gsm.hs.kr',
    email_confirmed_at: null,
    created_at: new Date().toISOString(),
  };
  const {
    supabase,
    repository,
    dataGsm,
    signupRequests,
    profileSetups,
    deletedUserIds,
  } = createDependencies({
    existingAuthUsers: [existingUser],
    profileExists: false,
  });
  const service = new AuthService(supabase, repository, dataGsm);

  await service.signup(
    'student@gsm.hs.kr',
    'password123',
    '홍길동',
    2103,
    { terms: true, privacy: true },
  );

  assert.deepEqual(deletedUserIds, ['orphaned-user-id']);
  assert.equal(signupRequests.length, 1);
  assert.equal(profileSetups.length, 1);
});

test('returns a clear conflict for an existing complete account', async () => {
  const existingUser = {
    id: 'existing-user-id',
    email: 'student@gsm.hs.kr',
    email_confirmed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };
  const {
    supabase,
    repository,
    dataGsm,
    signupRequests,
  } = createDependencies({ existingAuthUsers: [existingUser] });
  const service = new AuthService(supabase, repository, dataGsm);

  await assert.rejects(
    service.signup(
      'student@gsm.hs.kr',
      'password123',
      '홍길동',
      2103,
      { terms: true, privacy: true },
    ),
    (error) =>
      error.code === 'ACCOUNT_ALREADY_EXISTS' &&
      error.getStatus() === 409,
  );
  assert.equal(signupRequests.length, 0);
});

test('deletes an expired unconfirmed account before creating it again', async () => {
  const existingUser = {
    id: 'expired-user-id',
    email: 'student@gsm.hs.kr',
    email_confirmed_at: null,
    created_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
  };
  const {
    supabase,
    repository,
    dataGsm,
    signupRequests,
    deletedUserIds,
  } = createDependencies({ existingAuthUsers: [existingUser] });
  const service = new AuthService(supabase, repository, dataGsm);

  await service.signup(
    'student@gsm.hs.kr',
    'password123',
    '홍길동',
    2103,
    { terms: true, privacy: true },
  );

  assert.deepEqual(deletedUserIds, ['expired-user-id']);
  assert.equal(signupRequests.length, 1);
});

test('resends a signup verification email with a fresh one-hour window', async (t) => {
  const previousRedirect = process.env.AUTH_EMAIL_REDIRECT_URL;
  t.after(() => {
    if (previousRedirect === undefined) delete process.env.AUTH_EMAIL_REDIRECT_URL;
    else process.env.AUTH_EMAIL_REDIRECT_URL = previousRedirect;
  });
  process.env.AUTH_EMAIL_REDIRECT_URL = 'https://gsm-compass.vercel.app';

  const existingUser = {
    id: 'pending-user-id',
    email: 'student@gsm.hs.kr',
    email_confirmed_at: null,
    created_at: new Date().toISOString(),
  };
  const { supabase, repository, dataGsm, resendRequests } = createDependencies({
    existingAuthUsers: [existingUser],
  });
  const service = new AuthService(supabase, repository, dataGsm);

  const result = await service.resendVerification('student@gsm.hs.kr');

  assert.deepEqual(resendRequests, [
    {
      type: 'signup',
      email: 'student@gsm.hs.kr',
      options: {
        emailRedirectTo: 'https://gsm-compass.vercel.app/auth/confirmed',
      },
    },
  ]);
  assert.equal(result.data.verificationRequired, true);
  assert.ok(Date.parse(result.data.verificationExpiresAt) > Date.now());
});

test('enforces the resend cooldown without another provider request', async () => {
  const existingUser = {
    id: 'pending-user-id',
    email: 'student@gsm.hs.kr',
    email_confirmed_at: null,
    created_at: new Date().toISOString(),
  };
  const { supabase, repository, dataGsm, resendRequests } = createDependencies({
    existingAuthUsers: [existingUser],
  });
  const service = new AuthService(supabase, repository, dataGsm);

  await service.resendVerification('student@gsm.hs.kr');
  await assert.rejects(
    service.resendVerification('student@gsm.hs.kr'),
    (error) => error.code === 'VERIFICATION_RESEND_TOO_SOON',
  );
  assert.equal(resendRequests.length, 1);
});
