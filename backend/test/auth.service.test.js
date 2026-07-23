const test = require('node:test');
const assert = require('node:assert/strict');
require('ts-node/register/transpile-only');

const { AuthService } = require('../src/auth.service');

function createDependencies({
  student = { studentNumber: 2103 },
  studentLookupError = null,
} = {}) {
  const signupRequests = [];
  const signOutRequests = [];
  const studentLookupEmails = [];
  const user = {
    id: '5e08bc27-2cbd-4a26-a876-733c25de5f09',
    email: 'student@gsm.hs.kr',
    email_confirmed_at: '2026-07-23T00:00:00.000Z',
    user_metadata: { name: '홍길동' },
  };
  const authApi = {
    signUp: async (request) => {
      signupRequests.push(request);
      return {
        data: {
          user,
          session: {
            access_token: 'access-token',
            refresh_token: 'refresh-token',
            expires_at: 1234,
          },
        },
        error: null,
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
          deleteUser: async () => ({ error: null }),
        },
      },
    },
  };
  const profileSetups = [];
  const repository = {
    createSignupProfile: async (input) => profileSetups.push(input),
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
    signOutRequests,
    studentLookupEmails,
  };
}

test('signs up a verified-domain account and creates its local profile', async () => {
  const {
    supabase,
    repository,
    dataGsm,
    profileSetups,
    studentLookupEmails,
  } = createDependencies();
  const service = new AuthService(supabase, repository, dataGsm);

  const result = await service.signup(
    'Student@GSM.HS.KR',
    'password123',
    '홍길동',
    2103,
    { terms: true, privacy: true, notifications: false },
  );

  assert.equal(result.status, 'OK');
  assert.equal(result.data.token, 'access-token');
  assert.equal(result.data.session.accessToken, 'access-token');
  assert.equal(profileSetups.length, 1);
  assert.equal(profileSetups[0].studentNumber, 2103);
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
    'Test Student',
    2103,
    { terms: true, privacy: true },
  );

  assert.equal(
    signupRequests[0].options.emailRedirectTo,
    'https://gsm-compass.vercel.app/auth/confirmed',
  );
});

test('rejects a mismatched student number before creating an auth user', async () => {
  const {
    supabase,
    repository,
    dataGsm,
    signupRequests,
    profileSetups,
  } = createDependencies({ student: { studentNumber: 2201 } });
  const service = new AuthService(supabase, repository, dataGsm);

  await assert.rejects(
    service.signup(
      'student@gsm.hs.kr',
      'password123',
      'Test Student',
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
      'Test Student',
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
  const { supabase, dataGsm } = createDependencies();
  let deletedUserId = null;
  supabase.db.auth.admin.deleteUser = async (userId) => {
    deletedUserId = userId;
    return { error: null };
  };
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
  assert.equal(deletedUserId, '5e08bc27-2cbd-4a26-a876-733c25de5f09');
});
