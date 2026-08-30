function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function shell({ title, nonce, body }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>${escapeHtml(title)}</title>
  <style nonce="${escapeHtml(nonce)}">
    :root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#17372f;background:#edf7f2;font-synthesis:none}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at 14% 4%,#fff 0,#f5fbf7 28rem,#e7f3ee 70rem);line-height:1.5}a{color:inherit}.wrap{width:min(1180px,calc(100% - 32px));margin:auto}.mast{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:28px 0 18px}.brand{display:flex;align-items:center;gap:13px;text-decoration:none}.mark{display:grid;place-items:center;width:43px;height:43px;border-radius:15px;background:#153f34;color:#fff;font:700 22px Georgia,serif;box-shadow:0 9px 22px #17372f2b}.brand b{display:block;font-size:17px}.brand small{display:block;color:#5c756d}.logout{margin:0}.quiet,.primary{border:0;border-radius:999px;padding:10px 17px;font:700 14px inherit;cursor:pointer}.quiet{background:#fff;color:#31584d;box-shadow:inset 0 0 0 1px #cfe1da}.primary{background:#176b56;color:#fff;box-shadow:0 8px 20px #176b5638}.hero{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(240px,.7fr);gap:22px;align-items:stretch;padding:26px 0 30px}.hero-copy,.focus{border:1px solid #d1e4dc;border-radius:28px;background:#ffffffd9;box-shadow:0 22px 70px #1b55421a}.hero-copy{padding:clamp(28px,5vw,62px)}.eyebrow{margin:0 0 10px;color:#277861;font-weight:800;letter-spacing:.12em;text-transform:uppercase;font-size:12px}.hero h1{font:700 clamp(38px,6vw,72px)/1.03 Georgia,serif;letter-spacing:-.035em;margin:0;max-width:760px;color:#143a30}.hero p{max-width:700px;color:#526e65;font-size:17px}.focus{padding:28px;background:linear-gradient(145deg,#153f34,#246c59);color:#fff;display:flex;flex-direction:column;justify-content:flex-end}.focus strong{font:700 30px Georgia,serif}.focus span{color:#d9eee7}.section-head{display:flex;justify-content:space-between;align-items:end;gap:20px;margin:24px 2px 14px}.section-head h2{font:700 28px Georgia,serif;margin:0}.section-head p{margin:0;color:#60776f}.games{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;padding-bottom:56px}.game{position:relative;overflow:hidden;border:1px solid #d3e5de;border-radius:24px;padding:25px;background:#fff;box-shadow:0 13px 34px #244f4112}.game:before{content:"";position:absolute;right:-55px;top:-55px;width:150px;height:150px;border-radius:50%;background:#dff2e9}.game:nth-child(2):before{background:#f3e7d7}.game:nth-child(3):before{background:#e9e3f4}.game:nth-child(4):before{background:#f3dfdf}.game h3{position:relative;font:700 27px Georgia,serif;margin:3px 0}.game>p{position:relative;color:#647970;margin:0 0 18px}.links{position:relative;display:flex;flex-wrap:wrap;gap:9px}.links a{border-radius:999px;background:#f0f7f4;padding:8px 12px;text-decoration:none;font-weight:750;font-size:13px}.links a:hover,.links a:focus-visible{background:#1b6c57;color:#fff;outline:none}.login-shell{min-height:100vh;display:grid;place-items:center;padding:24px}.login-card{width:min(460px,100%);border:1px solid #d3e4dd;border-radius:28px;background:#ffffffeb;padding:clamp(28px,7vw,48px);box-shadow:0 28px 80px #1b554226}.login-card .mark{margin-bottom:23px}.login-card h1{font:700 39px/1.05 Georgia,serif;margin:0;color:#143a30}.login-card>p{color:#5f766e}.field{display:grid;gap:7px;margin:18px 0}.field span{font-weight:750;font-size:13px}.field input[type=text],.field input[type=password]{width:100%;border:1px solid #bfd5cd;border-radius:13px;padding:13px 14px;font:inherit;background:#fff}.remember{display:flex;gap:9px;align-items:center;color:#4c675e;font-size:14px}.login-card .primary{width:100%;margin-top:22px;padding:13px}.error{border-radius:12px;background:#fff0ed;color:#8d3428;padding:10px 12px;font-size:14px}.footer{color:#70857e;font-size:12px;margin-top:20px}.skip{position:absolute;left:-9999px}.skip:focus{left:16px;top:16px;background:white;padding:10px;z-index:10}@media(max-width:760px){.hero{grid-template-columns:1fr}.games{grid-template-columns:1fr}.mast{align-items:flex-start}.brand small{display:none}.focus{min-height:190px}}
  </style>
</head>
<body>${body}</body>
</html>`
}

export function loginPage({ nonce, csrf, next = '/', error = false }) {
  return shell({
    title: 'Sign in · LazyingArt Games',
    nonce,
    body: `<main class="login-shell">
      <section class="login-card" aria-labelledby="login-title">
        <div class="mark" aria-hidden="true">弈</div>
        <p class="eyebrow">Private teaching table</p>
        <h1 id="login-title">Welcome back.</h1>
        <p>One quiet entrance for Go, chess families, mahjong, and card study.</p>
        ${error ? '<p class="error" role="alert">The sign-in details were not accepted. Please try again.</p>' : ''}
        <form method="post" action="/auth/login" autocomplete="on">
          <input type="hidden" name="csrf" value="${escapeHtml(csrf)}">
          <input type="hidden" name="next" value="${escapeHtml(next)}">
          <label class="field"><span>Username</span><input name="username" type="text" autocomplete="username" maxlength="64" required autofocus></label>
          <label class="field"><span>Password</span><input name="password" type="password" autocomplete="current-password" maxlength="4096" required></label>
          <label class="remember"><input name="remember" type="checkbox" value="yes"> Keep me signed in on this device</label>
          <button class="primary" type="submit">Enter the game room</button>
        </form>
        <p class="footer">Your browser receives an opaque session only. Game computation stays on the private workstation.</p>
      </section>
    </main>`,
  })
}

export function portalPage({ nonce, username, csrf }) {
  const safeUser = escapeHtml(username)
  return shell({
    title: 'LazyingArt Games',
    nonce,
    body: `<a class="skip" href="#games">Skip to games</a>
    <header class="wrap mast">
      <a class="brand" href="/"><span class="mark" aria-hidden="true">弈</span><span><b>LazyingArt Games</b><small>Evidence-led play and study</small></span></a>
      <form class="logout" action="/auth/logout" method="post"><input type="hidden" name="csrf" value="${escapeHtml(csrf)}"><button class="quiet" type="submit">Sign out ${safeUser}</button></form>
    </header>
    <main class="wrap">
      <section class="hero">
        <div class="hero-copy"><p class="eyebrow">Choose a table</p><h1>Play slowly. See what changes.</h1><p>Rules and legal actions remain deterministic. Engines and learned players contribute bounded evidence for the exact position—never a pretend move.</p></div>
        <aside class="focus"><span>Today’s focus</span><strong>Read the reply before you commit.</strong></aside>
      </section>
      <div class="section-head" id="games"><div><p class="eyebrow">Game library</p><h2>Four families, one entrance</h2></div><p>Simple views open first.</p></div>
      <section class="games" aria-label="Game categories">
        <article class="game"><p class="eyebrow">Territory</p><h3>Weiqi · Go</h3><p>Shape, liberties, tactical reading, ownership evidence, and full-board reflection.</p><div class="links"><a href="/weiqi/?board=19">19 × 19</a><a href="/weiqi/?board=9">9 × 9</a><a href="/weiqi/?board=7">7 × 7</a></div></article>
        <article class="game"><p class="eyebrow">Chess family</p><h3>Chess · Xiangqi · Shogi</h3><p>Compare candidate moves, the likely reply, and transferable positional principles.</p><div class="links"><a href="/chess/?game=chess">Chess</a><a href="/chess/?game=xiangqi">Xiangqi</a><a href="/chess/?game=shogi">Shogi</a></div></article>
        <article class="game"><p class="eyebrow">Tiles</p><h3>Mahjong</h3><p>Exact waits and hand development, clearly separated from authored strategic teaching.</p><div class="links"><a href="/mahjong/?profile=riichi">Riichi</a><a href="/mahjong/?profile=mcr">Chinese official</a><a href="/mahjong/?profile=hong-kong">Hong Kong</a></div></article>
        <article class="game"><p class="eyebrow">Cards</p><h3>Poker and shedding games</h3><p>Hidden information stays private; learned evidence is bound to the same legal candidate set.</p><div class="links"><a href="/poker/?game=holdem">Hold’em</a><a href="/poker/?game=bridge">Bridge</a><a href="/poker/?game=guandan">Guandan</a><a href="/poker/?game=doudizhu">Doudizhu</a></div></article>
      </section>
    </main>`,
  })
}
