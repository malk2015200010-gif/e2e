const BASE = 'https://dev.mentoraeg.com'
const authUser = process.env.CYPRESS_auth_username || process.env.AUTH_USERNAME || ''
const authPass = process.env.CYPRESS_auth_password || process.env.AUTH_PASSWORD || ''
if (!authUser || !authPass) {
  console.error('Set CYPRESS_auth_username and CYPRESS_auth_password (or AUTH_*) before running this probe.')
  process.exit(1)
}
const basic = 'Basic ' + Buffer.from(`${authUser}:${authPass}`).toString('base64')

function parseSetCookie(h) {
  const jar = {}
  for (const sc of h.getSetCookie?.() || []) {
    const [p] = sc.split(';')
    const i = p.indexOf('=')
    if (i > 0) jar[p.slice(0, i).trim()] = p.slice(i + 1)
  }
  return jar
}
function cookieStr(j) {
  return Object.entries(j)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ')
}
async function req(path, { method = 'GET', body, jar = {}, redirect = 'manual' } = {}) {
  const url = path.startsWith('http') ? path : BASE + path
  const headers = { Authorization: basic }
  const cs = cookieStr(jar)
  if (cs) headers.Cookie = cs
  if (body) headers['Content-Type'] = 'application/x-www-form-urlencoded'
  const r = await fetch(url, { method, headers, body, redirect })
  return {
    status: r.status,
    loc: r.headers.get('location'),
    url: r.url,
    html: await r.text(),
    jar: { ...jar, ...parseSetCookie(r.headers) },
  }
}
async function follow(path, jar) {
  let cur = path
  let j = { ...jar }
  let hops = 0
  let last
  while (hops++ < 8) {
    last = await req(cur, { jar: j, redirect: 'manual' })
    j = last.jar
    if ([301, 302, 303, 307, 308].includes(last.status) && last.loc) {
      cur = last.loc.startsWith('http') ? last.loc : last.loc
      continue
    }
    return { ...last, finalPath: cur, jar: j }
  }
  return last
}
async function login(email, password) {
  let r = await follow('/login', {})
  const token = (r.html.match(/name="_token"\s+value="([^"]+)"/) || [])[1]
  r = await req('/login', {
    method: 'POST',
    jar: r.jar,
    body: new URLSearchParams({ _token: token, email, password }).toString(),
    redirect: 'manual',
  })
  let j = r.jar
  if (r.loc) {
    const f = await follow(r.loc, j)
    j = f.jar
    r = f
  }
  return { jar: j, finalPath: r.finalPath }
}
async function createAssistant(jar, name, email, password, perms) {
  let r = await follow('/dashboard/assistants/create', jar)
  const token = (r.html.match(/name="_token"\s+value="([^"]+)"/) || [])[1]
  const body = new URLSearchParams({
    _token: token,
    name,
    email,
    password,
    password_confirmation: password,
  })
  for (const p of perms) body.append('permissions[]', p)
  r = await req('/dashboard/assistants', {
    method: 'POST',
    jar: r.jar,
    body: body.toString(),
    redirect: 'manual',
  })
  if (r.loc) {
    const f = await follow(r.loc, r.jar)
    r = f
  }
  return { ok: r.html.includes(name), status: r.status, finalPath: r.finalPath }
}
async function checkAccess(email, password, path) {
  const { jar } = await login(email, password)
  const r = await follow(path, jar)
  const title = (r.html.match(/<title[^>]*>([^<]+)/i) || [])[1]?.trim()
  return {
    final: r.finalPath,
    status: r.status,
    title,
    hasForm: /<form/i.test(r.html),
    workingFor: /working for/i.test(r.html),
  }
}

;(async () => {
  const { jar: instrJar } = await login('malk2015200010a@gmail.com', '1234567')
  const stamp = Date.now()
  const cases = [
    { tag: 'manage', perms: ['withdraw.manage'] },
    { tag: 'view', perms: ['withdraw.view'] },
    { tag: 'both', perms: ['withdraw.view', 'withdraw.manage'] },
    { tag: 'earn+m', perms: ['earnings.view', 'withdraw.manage'] },
    { tag: 'none', perms: [] },
  ]
  for (const c of cases) {
    const name = `Probe ${c.tag} ${stamp}`
    const email = `probe.${c.tag}.${stamp}@mail.com`
    const password = 'Test@Pass123!'
    const created = await createAssistant(instrJar, name, email, password, c.perms)
    console.log('CREATE', c.tag, created.ok, created.status, created.finalPath)
    for (const path of ['/dashboard/withdraw', '/withdraw']) {
      const a = await checkAccess(email, password, path)
      console.log(
        ' ACCESS',
        c.tag,
        path,
        '->',
        a.final,
        '|',
        a.title,
        '| form',
        a.hasForm,
        '| working',
        a.workingFor,
      )
    }
  }
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
