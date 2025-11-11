addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  const params = url.searchParams;

  // === ⚙️ 配置区 ===
  const GITHUB_PAGES_URL = "https://modskyshop168-sudo.github.io/cc/";
  const EXPIRED_REDIRECT_URL = "https://life4u22.blogspot.com/p/powertech.html";
  const DEVICE_CONFLICT_URL = "https://life4u22.blogspot.com/p/id-ban.html";
  const NON_OTT_REDIRECT_URL = "https://life4u22.blogspot.com/p/ott-channel-review.html";
  const SIGN_SECRET = "mySuperSecretKey"; 
  const DEBUG_TOKEN = "AdminOnly123";  // ✅ 仅管理员知道的调试密钥
  const OTT_KEYWORDS = ["OTT Player", "OTT TV", "OTT Navigator"];
  // =================

  const ua = request.headers.get("User-Agent") || "";
  const isAndroid = ua.includes("Android");
  const isTV = /TV|AFT|MiBOX|SmartTV|BRAVIA|SHIELD/i.test(ua);
  const appType = OTT_KEYWORDS.find(k => ua.includes(k)) || (isTV ? "OTT-TV-Unknown" : null);

  // ❌ 非 OTT 设备
  if (!isAndroid || !appType) return Response.redirect(NON_OTT_REDIRECT_URL, 302);

  // 参数验证
  const uid = params.get("uid");
  const exp = Number(params.get("exp"));
  const sig = params.get("sig");
  if (!uid || !exp || !sig)
    return new Response("🚫 Invalid Link", { status: 403 });

  // 检查过期时间（马来西亚时区）
  const malaysiaNow = new Date(Date.now() + 8 * 60 * 60 * 1000);
  if (malaysiaNow.getTime() > exp)
    return Response.redirect(EXPIRED_REDIRECT_URL, 302);

  // 签名验证
  const text = `${uid}:${exp}`;
  const expectedSig = await sign(text, SIGN_SECRET);
  const sigValid = expectedSig === sig;
  if (!sigValid)
    return new Response("🚫 Invalid Signature", { status: 403 });

  // 生成设备指纹（不含 IP）
  const deviceFingerprint = await getDeviceFingerprint(ua, uid, SIGN_SECRET);

  // 读取 KV 数据
  const key = `uid:${uid}`;
  let stored = null;
  try {
    const raw = await UID_BINDINGS.get(key);
    if (raw) stored = JSON.parse(raw);
  } catch (e) {
    return new Response("⚠️ KV 读取失败，请检查配置。", { status: 500 });
  }

  // 首次登入
  if (!stored) {
    const toStore = { device: deviceFingerprint, apps: [appType] };
    await UID_BINDINGS.put(key, JSON.stringify(toStore));
    console.log(`✅ UID ${uid} 首次绑定 ${deviceFingerprint}, app=${appType}`);
  } 
  // 同设备
  else if (stored.device === deviceFingerprint) {
    console.log(`🟩 UID ${uid} 同设备访问 ${appType}`);
  } 
  // 不同设备 → 封锁
  else {
    console.log(`🚫 UID ${uid} 不同设备登入`);
    return Response.redirect(DEVICE_CONFLICT_URL, 302);
  }

  // 🧩 管理员 Debug 模式（需 token）
  const debugEnabled = url.searchParams.get("debug") === "1";
  const token = url.searchParams.get("token");
  if (debugEnabled && token === DEBUG_TOKEN) {
    const debugData = {
      uid,
      ua,
      exp,
      malaysiaTime: malaysiaNow.toISOString(),
      sigValid,
      deviceFingerprint,
      stored,
    };
    return new Response(JSON.stringify(debugData, null, 2), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ✅ 正常访问
  return fetch(`${GITHUB_PAGES_URL}${path}${url.search}`, request);
}

/** 🔐 生成签名 */
async function sign(text, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(text));
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

/** 📱 设备指纹（不含 IP）*/
async function getDeviceFingerprint(ua, uid, secret) {
  const cleanUA = ua.replace(/\s+/g, " ").trim().slice(0, 120);
  const base = `${uid}:${cleanUA}`;
  return await sign(base, secret);
                        }
