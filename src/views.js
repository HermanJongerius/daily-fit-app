import { esc, fmtDateLong, jointForDate, JOINTS_BY_WEEKDAY } from './helpers.js';

// Merkstijl, overgenomen uit de schets en de demo.
const COLORS = {
  cream: '#FBF6EC', white: '#FFFFFF', teal900: '#204A42', teal700: '#3A6B60',
  teal100: '#E3EFEA', coral600: '#E1703B', coral700: '#C15A29', ink: '#2E2B25',
  inkSoft: '#746C5F', border: '#E7DFCF', amber600: '#A6600F',
};

function logoMark(size = 40) {
  return `<div style="width:${size}px;height:${size}px;border-radius:${size * 0.28}px;background:${COLORS.teal900};display:flex;align-items:center;justify-content:center;">
    <svg width="${size * 0.55}" height="${size * 0.55}" viewBox="0 0 24 24" fill="none" stroke="${COLORS.cream}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 12h4l2 5 2-10 2 5h4"></path></svg>
  </div>`;
}

function layout({ title, body, headerRight = '' }) {
  return `<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — Daily Fit</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap">
<style>
  *{box-sizing:border-box;}
  html,body{margin:0;padding:0;background:${COLORS.cream};}
  body{font-family:'Nunito','Segoe UI',system-ui,sans-serif;color:${COLORS.ink};}
  button{cursor:pointer;}
  input,select{outline:none;}
  input:focus,select:focus{border-color:${COLORS.teal700} !important;}
  a{color:inherit;}
</style>
</head>
<body>
${body}
</body>
</html>`;
}

function demoFooter(extra = '') {
  return `<div style="text-align:center;padding:18px 20px;font-size:12px;font-weight:600;color:${COLORS.inkSoft};">Daily Fit ${extra}</div>`;
}

export function loginPage({ error }) {
  const body = `
  <div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 20px 70px;background:${COLORS.cream};">
    <div style="width:100%;max-width:380px;">
      <div style="display:flex;flex-direction:column;align-items:center;gap:10px;margin-bottom:28px;">
        ${logoMark(60)}
        <div style="font-size:24px;font-weight:900;color:${COLORS.teal900};">Daily Fit</div>
        <div style="font-size:14px;font-weight:600;color:${COLORS.inkSoft};">Elke dag een beetje bewegen</div>
      </div>
      <form method="post" action="/login" style="background:${COLORS.white};border:1px solid ${COLORS.border};border-radius:20px;padding:28px 24px;display:flex;flex-direction:column;gap:16px;">
        <div style="font-size:22px;font-weight:800;">Inloggen</div>
        ${error ? `<div style="background:#FBEDD3;color:${COLORS.amber600};padding:10px 14px;border-radius:12px;font-size:14px;font-weight:700;">${esc(error)}</div>` : ''}
        <label style="display:flex;flex-direction:column;gap:6px;font-size:14px;font-weight:700;">Gebruikersnaam
          <input name="username" autocomplete="username" style="height:52px;border-radius:14px;border:2px solid ${COLORS.border};padding:0 14px;font-size:17px;font-family:inherit;" /></label>
        <label style="display:flex;flex-direction:column;gap:6px;font-size:14px;font-weight:700;">Wachtwoord of mobiel nummer
          <input name="credential" type="text" inputmode="tel" autocomplete="off" style="height:52px;border-radius:14px;border:2px solid ${COLORS.border};padding:0 14px;font-size:17px;font-family:inherit;" /></label>
        <button type="submit" style="height:56px;border:none;border-radius:16px;background:${COLORS.coral600};color:${COLORS.white};font-family:inherit;font-size:18px;font-weight:800;">Inloggen</button>
      </form>
    </div>
  </div>${demoFooter('&mdash; werkende versie')}`;
  return layout({ title: 'Inloggen', body });
}

export function vandaagPage({ user, schedule, done, weekDots }) {
  const today = new Date();
  const joint = jointForDate(today);
  const tomorrow = new Date(today.getTime() + 86400000);
  const tomorrowJoint = jointForDate(tomorrow);

  let center;
  if (!schedule) {
    center = `<div style="font-size:20px;font-weight:800;margin-top:16px;">Nog geen oefening gepland</div>
      <div style="font-size:15px;font-weight:600;color:${COLORS.inkSoft};margin-top:6px;">Kom later terug, of vraag de beheerder om de planning aan te vullen.</div>`;
  } else if (done) {
    center = `<div style="width:96px;height:96px;border-radius:50%;background:${COLORS.teal100};display:flex;align-items:center;justify-content:center;">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="${COLORS.teal700}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
      <div style="font-size:26px;font-weight:900;margin-top:16px;">Je hebt vandaag al bewogen!</div>
      <div style="font-size:16px;font-weight:600;color:${COLORS.inkSoft};margin-top:8px;">Knap gedaan. Morgen staat de ${esc(tomorrowJoint.toLowerCase())}oefening klaar.</div>`;
  } else if (schedule.video_status !== 'ready') {
    center = `<div style="font-size:20px;font-weight:800;margin-top:16px;">De oefening van vandaag wordt nog klaargezet</div>
      <div style="font-size:15px;font-weight:600;color:${COLORS.inkSoft};margin-top:6px;">Probeer het over een paar minuten opnieuw.</div>`;
  } else {
    center = `<div style="font-size:15px;font-weight:700;color:${COLORS.inkSoft};text-transform:uppercase;letter-spacing:0.06em;">Vandaag</div>
      <div style="font-size:34px;font-weight:900;color:${COLORS.teal900};margin-top:6px;">${esc(joint)}oefening</div>
      <a href="/video" style="margin-top:24px;display:inline-flex;align-items:center;gap:10px;height:64px;padding:0 36px;border-radius:20px;background:${COLORS.coral600};color:${COLORS.white};font-size:19px;font-weight:800;text-decoration:none;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"></polygon></svg> Start de oefening</a>`;
  }

  const body = `
  <div style="min-height:100vh;display:flex;flex-direction:column;background:${COLORS.cream};padding-bottom:64px;">
    <div style="display:flex;align-items:center;justify-content:space-between;padding:20px 22px 0;">
      <div style="display:flex;align-items:center;gap:8px;">${logoMark(30)}<div style="font-weight:800;font-size:16px;color:${COLORS.teal900};">Daily Fit</div></div>
      <form method="post" action="/logout"><button type="submit" style="background:none;border:none;font-family:inherit;font-size:13px;font-weight:700;color:${COLORS.inkSoft};">Uitloggen</button></form>
    </div>
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px;max-width:420px;margin:0 auto;width:100%;">
      <div style="font-size:15px;font-weight:700;color:${COLORS.inkSoft};">Hallo ${esc(user.display_name)}</div>
      ${center}
      <div style="margin-top:32px;">${weekDots}</div>
    </div>
  </div>${demoFooter()}`;
  return layout({ title: 'Vandaag', body });
}

export function videoPage({ schedule, streamEmbedSrc, devMode }) {
  const player = streamEmbedSrc
    ? `<iframe src="${esc(streamEmbedSrc)}" style="width:100%;aspect-ratio:16/9;border:none;border-radius:18px;" allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;" allowfullscreen></iframe>`
    : `<div style="width:100%;aspect-ratio:16/9;border-radius:18px;background:${COLORS.teal900};color:${COLORS.cream};display:flex;align-items:center;justify-content:center;text-align:center;padding:20px;font-weight:700;">
         Cloudflare Stream is nog niet geconfigureerd (CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN / CLOUDFLARE_STREAM_CUSTOMER_CODE ontbreken).
       </div>`;
  const devNotice = devMode
    ? `<div style="margin-top:16px;background:#FBEDD3;color:${COLORS.amber600};padding:10px 14px;border-radius:12px;font-size:13px;font-weight:700;">Ontwikkelmodus: er is geen echte videokoppeling, dus hieronder kun je de oefening handmatig als "afgerond" markeren om de rest van de flow te testen.</div>`
    : '';
  const devButton = devMode
    ? `<form method="post" action="/video/complete" style="margin-top:14px;"><button type="submit" style="height:52px;padding:0 28px;border:none;border-radius:16px;background:${COLORS.teal700};color:${COLORS.white};font-family:inherit;font-size:15px;font-weight:800;">(dev) Markeer als uitgekeken</button></form>`
    : '';
  const body = `
  <div style="min-height:100vh;display:flex;flex-direction:column;background:${COLORS.cream};padding-bottom:64px;">
    <div style="display:flex;align-items:center;justify-content:space-between;padding:20px 22px 0;">
      <a href="/vandaag" style="text-decoration:none;font-size:13px;font-weight:700;color:${COLORS.inkSoft};">&larr; Terug</a>
    </div>
    <div style="max-width:520px;margin:0 auto;width:100%;padding:24px;">
      <div style="font-size:22px;font-weight:900;margin-bottom:14px;">${esc(schedule.joint)}oefening</div>
      ${player}
      ${devNotice}${devButton}
    </div>
  </div>${demoFooter()}`;
  return layout({ title: 'Oefening', body });
}

export function errorPage() {
  const body = `
  <div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;background:${COLORS.cream};padding:24px;">
    ${logoMark(44)}
    <div style="font-size:22px;font-weight:900;margin-top:18px;">Er ging iets mis</div>
    <div style="font-size:16px;font-weight:600;color:${COLORS.inkSoft};margin-top:8px;max-width:380px;">Probeer het over een moment nog eens. Blijft dit gebeuren? Neem dan contact op met de beheerder.</div>
    <a href="/login" style="margin-top:20px;background:${COLORS.teal900};color:${COLORS.cream};text-decoration:none;font-weight:700;padding:12px 22px;border-radius:12px;">Terug naar inloggen</a>
  </div>`;
  return layout({ title: 'Er ging iets mis', body });
}

export function expiredPage({ user }) {
  const body = `
  <div style="min-height:100vh;display:flex;flex-direction:column;background:${COLORS.cream};padding-bottom:64px;">
    <div style="display:flex;align-items:center;justify-content:space-between;padding:20px 22px 0;">
      <div style="display:flex;align-items:center;gap:8px;">${logoMark(30)}<div style="font-weight:800;font-size:16px;color:${COLORS.teal900};">Daily Fit</div></div>
      <form method="post" action="/logout"><button type="submit" style="background:none;border:none;font-family:inherit;font-size:13px;font-weight:700;color:${COLORS.inkSoft};">Uitloggen</button></form>
    </div>
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px;max-width:420px;margin:0 auto;width:100%;">
      <div style="font-size:24px;font-weight:900;margin-top:16px;">Je toegang is verlopen</div>
      <div style="font-size:16px;font-weight:600;color:${COLORS.inkSoft};margin-top:8px;">${user.paid_until ? `Verlopen sinds ${fmtDateLong(user.paid_until)}. ` : ''}Neem contact op met de beheerder om je abonnement te verlengen.</div>
    </div>
  </div>${demoFooter()}`;
  return layout({ title: 'Verlopen', body });
}

// --- Beheerder ---

function adminShell(active, body) {
  const tabs = [
    ['planning', 'Planning', '/admin/planning'],
    ['gebruikers', 'Gebruikers', '/admin/gebruikers'],
  ];
  const nav = tabs.map(([key, label, href]) =>
    `<a href="${href}" style="text-decoration:none;padding:10px 18px;border-radius:12px;font-size:14px;font-weight:800;${key === active ? `background:${COLORS.teal900};color:${COLORS.cream};` : `color:${COLORS.inkSoft};`}">${label}</a>`
  ).join('');
  return `
  <div style="min-height:100vh;background:${COLORS.cream};">
    <div style="display:flex;align-items:center;justify-content:space-between;padding:20px 28px;border-bottom:1px solid ${COLORS.border};">
      <div style="display:flex;align-items:center;gap:10px;">${logoMark(32)}<div style="font-weight:900;font-size:18px;color:${COLORS.teal900};">Daily Fit — Beheer</div></div>
      <form method="post" action="/logout"><button type="submit" style="background:none;border:none;font-family:inherit;font-size:13px;font-weight:700;color:${COLORS.inkSoft};">Uitloggen</button></form>
    </div>
    <div style="display:flex;gap:6px;padding:16px 28px 0;">${nav}</div>
    <div style="padding:24px 28px 60px;max-width:1000px;">${body}</div>
  </div>`;
}

function videoStatusBadge(s) {
  const map = {
    ready: [`Klaar`, COLORS.teal100, COLORS.teal900],
    processing: [`Wordt verwerkt`, '#FBEDD3', COLORS.amber600],
    none: [`Geen video`, '#F1EBDD', COLORS.inkSoft],
  };
  const [label, bg, fg] = map[s] || map.none;
  return `<span style="background:${bg};color:${fg};padding:3px 10px;border-radius:999px;font-size:11px;font-weight:800;">${label}</span>`;
}

export function planningPage({ days, cfConfigured }) {
  const plannedCount = days.filter((d) => d.video_status === 'ready').length;
  const rows = days.map((d) => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border:1px solid ${COLORS.border};border-radius:14px;background:${COLORS.white};margin-bottom:10px;">
      <div>
        <div style="font-size:13px;font-weight:700;color:${COLORS.inkSoft};">${fmtDateLong(d.date)}</div>
        <div style="font-size:16px;font-weight:800;">${esc(d.joint)}oefening ${videoStatusBadge(d.video_status)}</div>
        <div style="font-size:12px;color:${COLORS.inkSoft};margin-top:2px;">${d.video_label ? esc(d.video_label) : 'nog geen video geüpload'}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end;">
        <input type="file" accept="video/*" data-upload-date="${d.date}" ${cfConfigured ? '' : 'disabled'} style="font-size:12px;max-width:180px;" />
        <span data-status-for="${d.date}" style="font-size:11px;color:${COLORS.inkSoft};"></span>
      </div>
    </div>`).join('');

  const notConfiguredNotice = cfConfigured ? '' : `<div style="background:#FBEDD3;color:${COLORS.amber600};padding:10px 14px;border-radius:12px;font-size:13px;font-weight:700;margin-bottom:16px;">Cloudflare Stream is nog niet ingesteld op de server (CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN). Video-upload staat daarom uit.</div>`;

  const body = `
    <div style="margin-bottom:20px;">
      <div style="font-size:24px;font-weight:900;">Planning</div>
      <div style="font-size:14px;font-weight:600;color:${COLORS.inkSoft};margin-top:4px;">${plannedCount} van de ${days.length} dagen heeft een klare video. Kies per dag een videobestand om te uploaden.</div>
    </div>
    ${notConfiguredNotice}
    ${rows}
    <script>
      document.querySelectorAll('input[data-upload-date]').forEach(function (input) {
        input.addEventListener('change', async function () {
          var date = input.getAttribute('data-upload-date');
          var statusEl = document.querySelector('[data-status-for="' + date + '"]');
          var file = input.files[0];
          if (!file) return;
          statusEl.textContent = 'Upload-link aanvragen...';
          try {
            var res = await fetch('/admin/planning/' + date + '/upload-url', { method: 'POST' });
            var data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Onbekende fout');
            statusEl.textContent = 'Video uploaden...';
            var form = new FormData();
            form.append('file', file);
            var uploadRes = await fetch(data.uploadUrl, { method: 'POST', body: form });
            if (!uploadRes.ok) throw new Error('Upload naar Cloudflare mislukt');
            statusEl.textContent = 'Wordt verwerkt door Cloudflare...';
            await fetch('/admin/planning/' + date + '/attach', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ uid: data.uid, label: file.name }),
            });
            statusEl.textContent = 'Klaar — pagina wordt ververst...';
            setTimeout(function () { window.location.reload(); }, 1200);
          } catch (err) {
            statusEl.textContent = 'Fout: ' + err.message;
          }
        });
      });
    </script>`;
  return layout({ title: 'Planning', body: adminShell('planning', body) });
}

function paidStatusBadge(u) {
  if (u.role === 'admin') return '';
  if (!u.paid_until) return `<span style="background:#FBEDD3;color:${COLORS.amber600};padding:2px 8px;border-radius:999px;font-size:11px;font-weight:800;">Geen betaaldatum</span>`;
  const expired = new Date(u.paid_until) < new Date(new Date().setHours(0, 0, 0, 0));
  return expired
    ? `<span style="background:#FBEDD3;color:${COLORS.amber600};padding:2px 8px;border-radius:999px;font-size:11px;font-weight:800;">Verlopen sinds ${fmtDateLong(u.paid_until)}</span>`
    : `<span style="background:${COLORS.teal100};color:${COLORS.teal900};padding:2px 8px;border-radius:999px;font-size:11px;font-weight:800;">Actief tot ${fmtDateLong(u.paid_until)}</span>`;
}

export function usersPage({ users, error }) {
  const rows = users.map((u) => `
    <div style="padding:14px 16px;border:1px solid ${COLORS.border};border-radius:14px;background:${COLORS.white};margin-bottom:10px;">
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <div>
          <div style="font-size:15px;font-weight:800;">${esc(u.display_name)}</div>
          <div style="font-size:12px;font-weight:600;color:${COLORS.inkSoft};">@${esc(u.username)}${u.role !== 'admin' && u.phone_display ? ' &middot; ' + esc(u.phone_display) : ''}</div>
          ${paidStatusBadge(u)}
        </div>
        <div style="background:${u.role === 'admin' ? COLORS.teal100 : '#FBEDD3'};color:${u.role === 'admin' ? COLORS.teal900 : COLORS.amber600};padding:4px 10px;border-radius:999px;font-size:11px;font-weight:800;">${u.role === 'admin' ? 'Beheerder' : 'Senior'}</div>
      </div>
      <form method="post" action="/admin/gebruikers/${esc(u.username)}" style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;align-items:end;">
        <label style="display:flex;flex-direction:column;gap:2px;font-size:11px;font-weight:700;color:${COLORS.inkSoft};">Naam<input name="displayName" value="${esc(u.display_name)}" style="height:34px;border-radius:8px;border:1px solid ${COLORS.border};padding:0 8px;font-size:12px;font-family:inherit;" /></label>
        ${u.role !== 'admin' ? `<label style="display:flex;flex-direction:column;gap:2px;font-size:11px;font-weight:700;color:${COLORS.inkSoft};">Mobiel nummer<input name="phone" value="${esc(u.phone_display || '')}" style="height:34px;border-radius:8px;border:1px solid ${COLORS.border};padding:0 8px;font-size:12px;font-family:inherit;" /></label>
        <label style="display:flex;flex-direction:column;gap:2px;font-size:11px;font-weight:700;color:${COLORS.inkSoft};">Betaald tot<input name="paidUntil" type="date" value="${u.paid_until ? new Date(u.paid_until).toISOString().slice(0, 10) : ''}" style="height:34px;border-radius:8px;border:1px solid ${COLORS.border};padding:0 8px;font-size:12px;font-family:inherit;" /></label>` : ''}
        <button type="submit" style="height:34px;padding:0 14px;border:none;border-radius:8px;background:${COLORS.coral600};color:${COLORS.white};font-family:inherit;font-size:12px;font-weight:800;">Opslaan</button>
      </form>
    </div>`).join('');

  const body = `
    <div style="margin-bottom:20px;">
      <div style="font-size:24px;font-weight:900;">Gebruikers</div>
      <div style="font-size:14px;font-weight:600;color:${COLORS.inkSoft};margin-top:4px;">Accounts worden handmatig aangemaakt en persoonlijk doorgegeven &mdash; geen zelfregistratie.</div>
    </div>
    <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:24px;align-items:start;">
      <div>${rows}</div>
      <form method="post" action="/admin/gebruikers" style="background:${COLORS.white};border:1px solid ${COLORS.border};border-radius:18px;padding:20px;display:flex;flex-direction:column;gap:12px;">
        <div style="font-size:16px;font-weight:800;">Nieuw account aanmaken</div>
        ${error ? `<div style="background:#FBEDD3;color:${COLORS.amber600};padding:8px 12px;border-radius:10px;font-size:13px;font-weight:700;">${esc(error)}</div>` : ''}
        <input name="displayName" placeholder="Naam (bv. Corrie)" style="height:44px;border-radius:12px;border:1px solid ${COLORS.border};padding:0 12px;font-size:14px;font-family:inherit;" />
        <input name="username" placeholder="Gebruikersnaam" style="height:44px;border-radius:12px;border:1px solid ${COLORS.border};padding:0 12px;font-size:14px;font-family:inherit;" />
        <select name="role" style="height:44px;border-radius:12px;border:1px solid ${COLORS.border};padding:0 12px;font-size:14px;font-family:inherit;"><option value="senior">Senior</option><option value="admin">Beheerder</option></select>
        <input name="phone" placeholder="Mobiel nummer (voor senior)" style="height:44px;border-radius:12px;border:1px solid ${COLORS.border};padding:0 12px;font-size:14px;font-family:inherit;" />
        <input name="password" placeholder="Wachtwoord (voor beheerder)" type="password" style="height:44px;border-radius:12px;border:1px solid ${COLORS.border};padding:0 12px;font-size:14px;font-family:inherit;" />
        <label style="display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:700;color:${COLORS.inkSoft};">Betaald tot (optioneel)<input name="paidUntil" type="date" style="height:44px;border-radius:12px;border:1px solid ${COLORS.border};padding:0 12px;font-size:14px;font-family:inherit;" /></label>
        <button type="submit" style="height:46px;border:none;border-radius:12px;background:${COLORS.coral600};color:${COLORS.white};font-family:inherit;font-size:14px;font-weight:800;">Account aanmaken</button>
      </form>
    </div>`;
  return layout({ title: 'Gebruikers', body: adminShell('gebruikers', body) });
}
