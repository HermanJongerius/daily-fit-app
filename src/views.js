import { esc, fmtDateLong, jointForDate, JOINTS_BY_WEEKDAY, APP_VERSION, isoDateLocal, todayIso } from './helpers.js';

// Merkstijl, overgenomen uit de schets en de demo.
const COLORS = {
  cream: '#FBF6EC', white: '#FFFFFF', teal900: '#204A42', teal700: '#3A6B60',
  teal100: '#E3EFEA', coral600: '#E1703B', coral700: '#C15A29', ink: '#2E2B25',
  inkSoft: '#746C5F', border: '#E7DFCF', amber600: '#A6600F',
};

// Het nieuwe DailyFit-logo (het "D"-icoon), aangeleverd als afbeelding, hier ingebed als
// data-URI zodat er geen los bestand nodig is. Alleen de vorm is overgenomen: het is
// hertekend in de bestaande merkkleur (crème) zodat het icoon blijft passen in het
// bestaande donkergroene rondje/badge-uiterlijk dat overal in de app wordt gebruikt.
const LOGO_ICON_B64 = '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';

function logoMark(size = 40) {
  const iconHeight = size * 0.62;
  const iconWidth = iconHeight * (96 / 132);
  return `<div style="width:${size}px;height:${size}px;border-radius:${size * 0.28}px;background:${COLORS.teal900};display:flex;align-items:center;justify-content:center;">
    <img src="data:image/png;base64,${LOGO_ICON_B64}" width="${iconWidth}" height="${iconHeight}" alt="DailyFit" style="display:block;" />
  </div>`;
}

function layout({ title, body, headerRight = '', extraHead = '' }) {
  return `<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — DailyFit</title>
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
${extraHead}
</head>
<body>
${body}
</body>
</html>`;
}

function demoFooter(extra = '') {
  return `<div style="text-align:center;padding:18px 20px;font-size:12px;font-weight:600;color:${COLORS.inkSoft};">DailyFit ${extra ? extra + ' ' : ''}&middot; v${APP_VERSION}</div>`;
}

export function loginPage({ error }) {
  const body = `
  <div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 20px 70px;background:${COLORS.cream};">
    <div style="width:100%;max-width:380px;">
      <div style="display:flex;flex-direction:column;align-items:center;gap:10px;margin-bottom:28px;">
        ${logoMark(60)}
        <div style="font-size:24px;font-weight:900;color:${COLORS.teal900};">DailyFit</div>
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
    center = `<div style="font-size:20px;font-weight:800;margin-top:16px;">Nog geen oefeningen gepland</div>
      <div style="font-size:15px;font-weight:600;color:${COLORS.inkSoft};margin-top:6px;">Kom later terug, of vraag de beheerder om de planning aan te vullen.</div>`;
  } else if (done) {
    center = `<div style="width:96px;height:96px;border-radius:50%;background:${COLORS.teal100};display:flex;align-items:center;justify-content:center;">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="${COLORS.teal700}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
      <div style="font-size:26px;font-weight:900;margin-top:16px;">Je hebt vandaag al bewogen!</div>
      <div style="font-size:16px;font-weight:600;color:${COLORS.inkSoft};margin-top:8px;">Knap gedaan. Morgen staan de ${esc(tomorrowJoint.toLowerCase())}oefeningen klaar.</div>`;
  } else if (schedule.video_status !== 'ready') {
    center = `<div style="font-size:20px;font-weight:800;margin-top:16px;">De oefeningen van vandaag worden nog klaargezet</div>
      <div style="font-size:15px;font-weight:600;color:${COLORS.inkSoft};margin-top:6px;">Probeer het over een paar minuten opnieuw.</div>`;
  } else {
    center = `<div style="font-size:15px;font-weight:700;color:${COLORS.inkSoft};text-transform:uppercase;letter-spacing:0.06em;">Vandaag</div>
      <div style="font-size:34px;font-weight:900;color:${COLORS.teal900};margin-top:6px;">${esc(joint)}oefeningen</div>
      <a href="/video" style="margin-top:24px;display:inline-flex;align-items:center;gap:10px;height:64px;padding:0 36px;border-radius:20px;background:${COLORS.coral600};color:${COLORS.white};font-size:19px;font-weight:800;text-decoration:none;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"></polygon></svg> Start de oefeningen</a>`;
  }

  const body = `
  <div style="min-height:100vh;display:flex;flex-direction:column;background:${COLORS.cream};padding-bottom:64px;">
    <div style="display:flex;align-items:center;justify-content:space-between;padding:20px 22px 0;">
      <div style="display:flex;align-items:center;gap:8px;">${logoMark(30)}<div style="font-weight:800;font-size:16px;color:${COLORS.teal900};">DailyFit</div></div>
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

export function videoPage({ schedule, streamEmbedSrc, devMode, durationSec }) {
  // Bij een echte video wordt de Cloudflare Stream-speler-SDK geladen zodat we kunnen
  // herkennen wanneer het afspelen voltooid is: pas dan tellen de oefeningen als gedaan en
  // wordt automatisch naar /vandaag doorgestuurd (waar de server het al blokkeert om
  // vandaag nog een keer te kijken). Twee onafhankelijke signalen worden gebruikt, omdat
  // het "ended"-event van Cloudflare's speler-koppeling in de praktijk niet altijd
  // doorkomt: naast "ended" wordt ook continu de afspeelpositie gevolgd ("timeupdate") en
  // als beveiliging verschijnt er hoe dan ook een handmatige knop zodra de video (volgens
  // de bekende lengte) uitgekeken had moeten zijn, zodat iemand nooit vast kan komen te
  // zitten op dit scherm.
  const fallbackSeconds = (durationSec && durationSec > 0 ? durationSec : 330) + 5;
  const player = streamEmbedSrc
    ? `<style>
         /* Schermvullende weergave met gewone opmaak (werkt op elk toestel, ook iPhone) i.p.v.
            te vertrouwen op de "fullscreen"-functie van de browser zelf, die op iPhone/Safari
            niet altijd werkt voor een ingesloten video. Basisplaatsing staat hier, in de
            stylesheet — bewust NIET als inline "style"-attribuut op het element, want een
            inline stijl wint altijd van een class hieronder, ook al is "video-fill" specifieker
            geschreven. Dat was de eigenlijke fout waardoor het eerder niet werkte: de class
            werd wel toegevoegd, maar de inline "position:relative" op het element negeerde de
            "position:fixed" hieronder stilzwijgend. */
         #video-frame-wrap { position:relative; width:100%; }
         #video-frame-wrap.video-fill {
           position:fixed; top:0; right:0; bottom:0; left:0;
           width:100vw; height:100vh; width:100dvw; height:100dvh;
           max-width:none; z-index:2147483647; background:#000; border-radius:0; margin:0;
         }
         #video-frame-wrap.video-fill #stream-player { width:100%; height:100%; aspect-ratio:auto; border-radius:0; }
         #video-frame-wrap.video-fill #start-video-button { border-radius:0; }
         html.video-fill-lock, body.video-fill-lock { overflow:hidden; height:100%; }
       </style>
       <div id="video-frame-wrap">
         <iframe id="stream-player" src="${esc(streamEmbedSrc)}" style="width:100%;aspect-ratio:16/9;border:none;border-radius:18px;display:block;" allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>
         <button type="button" id="start-video-button" style="position:absolute;top:0;right:0;bottom:0;left:0;width:100%;height:100%;border:none;border-radius:18px;background:rgba(32,74,66,0.88);color:${COLORS.white};font-family:inherit;font-size:19px;font-weight:800;display:flex;align-items:center;justify-content:center;gap:10px;">
           <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"></polygon></svg> Start de video
         </button>
       </div>
       <div id="fallback-wrap" style="display:none;margin-top:14px;">
         <div style="font-size:13px;font-weight:700;color:${COLORS.inkSoft};margin-bottom:8px;">Video uitgekeken?</div>
         <button type="button" id="fallback-button" style="height:52px;padding:0 28px;border:none;border-radius:16px;background:${COLORS.teal700};color:${COLORS.white};font-family:inherit;font-size:15px;font-weight:800;">Ja, ga verder</button>
       </div>
       <script src="https://embed.cloudflarestream.com/embed/sdk.latest.js"></script>
       <script>
         (function () {
           var iframeEl = document.getElementById('stream-player');
           var wrapEl = document.getElementById('video-frame-wrap');
           var done = false;
           // De Cloudflare-koppeling zelf kan om allerlei redenen niet laden (traag netwerk,
           // adblocker, tijdelijke storing) — dat mag het vangnet hieronder nooit blokkeren,
           // dus dit gebeurt beschermd en de rest van de code gaat altijd door.
           var player = null;
           try {
             if (typeof Stream === 'function') player = Stream(iframeEl);
           } catch (e) {
             player = null;
           }

           function enterFillScreen() {
             // Eigen schermvullende weergave (werkt altijd, ook op iPhone/Safari). De
             // scroll-vergrendeling gaat op zowel <html> als <body>, omdat het niet
             // hetzelfde element is dat scrollt op elke (ingebedde) browser.
             wrapEl.classList.add('video-fill');
             document.documentElement.classList.add('video-fill-lock');
             document.body.classList.add('video-fill-lock');
             window.scrollTo(0, 0);
             // Daarnaast: als de browser het wél ondersteunt, ook echt "fullscreen"
             // aanvragen (verbergt op sommige toestellen ook de adresbalk). Dit is een
             // bonus, geen vereiste — als het niet lukt of niet bestaat, gebeurt er
             // gewoon niets en blijft de eigen schermvullende weergave hierboven staan.
             var requestFs = iframeEl.requestFullscreen || iframeEl.webkitRequestFullscreen;
             if (requestFs) {
               try { requestFs.call(iframeEl); } catch (e) {}
             }
           }

           function exitFillScreen() {
             wrapEl.classList.remove('video-fill');
             document.documentElement.classList.remove('video-fill-lock');
             document.body.classList.remove('video-fill-lock');
             var exit = document.exitFullscreen || document.webkitExitFullscreen;
             if ((document.fullscreenElement || document.webkitFullscreenElement) && exit) {
               try { exit.call(document); } catch (e) {}
             }
           }

           function markDone() {
             if (done) return;
             done = true;
             exitFillScreen();
             // Ga naar waar de server ons na het registreren van de training heen stuurt
             // (het voortgangsscherm, /voortgang) — niet naar een vast adres hier in de
             // code. "fetch" volgt een server-redirect vanzelf en "response.url" is dan al
             // het eindadres; alleen als dat om wat voor reden dan ook ontbreekt, valt dit
             // terug op /voortgang zelf.
             fetch('/video/complete', { method: 'POST' }).then(function (response) {
               window.location.href = response.url || '/voortgang';
             });
           }

           // Groot startscherm i.p.v. automatisch afspelen: een tik hierop is de
           // "gebruikersactie" die nodig is om zowel het geluid te mogen starten als
           // het scherm volledig te vullen (dat mag een browser niet vanzelf doen).
           var startButton = document.getElementById('start-video-button');
           if (startButton) {
             startButton.addEventListener('click', function () {
               enterFillScreen();
               if (player) {
                 try { player.play(); } catch (e) {}
               }
               startButton.style.display = 'none';
             });
           }

           if (player) {
             player.addEventListener('ended', markDone);
             // Vangnet 1: sommige browsers/koppelingen laten "ended" niet altijd doorkomen,
             // dus ook de afspeelpositie zelf checken.
             player.addEventListener('timeupdate', function () {
               if (player.duration && player.currentTime >= player.duration - 0.75) markDone();
             });
           }
           // Vangnet 2: staat hoe dan ook aan, ook als de speler-koppeling hierboven niet
           // laadde — als er na de bekende videolengte nog niets is gebeurd, laat dan een
           // knop zien zodat iemand nooit vast blijft zitten op dit scherm.
           setTimeout(function () {
             if (done) return;
             exitFillScreen();
             var wrap = document.getElementById('fallback-wrap');
             if (wrap) wrap.style.display = '';
           }, ${fallbackSeconds * 1000});
           var fallbackButton = document.getElementById('fallback-button');
           if (fallbackButton) fallbackButton.addEventListener('click', markDone);
         })();
       </script>`
    : `<div style="width:100%;aspect-ratio:16/9;border-radius:18px;background:${COLORS.teal900};color:${COLORS.cream};display:flex;align-items:center;justify-content:center;text-align:center;padding:20px;font-weight:700;">
         Cloudflare Stream is nog niet geconfigureerd (CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN / CLOUDFLARE_STREAM_CUSTOMER_CODE ontbreken).
       </div>`;
  const devNotice = devMode
    ? `<div style="margin-top:16px;background:#FBEDD3;color:${COLORS.amber600};padding:10px 14px;border-radius:12px;font-size:13px;font-weight:700;">Ontwikkelmodus: er is geen echte videokoppeling, dus hieronder kun je de oefeningen handmatig als "afgerond" markeren om de rest van de flow te testen.</div>`
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
      <div style="font-size:22px;font-weight:900;margin-bottom:14px;">${esc(schedule.joint)}oefeningen</div>
      ${player}
      ${devNotice}${devButton}
    </div>
  </div>${demoFooter()}`;
  return layout({ title: 'Oefeningen', body });
}

// Het "onthullingsscherm": verschijnt na elke training. Toont de persoonlijke 7-daagse
// cyclus (los van de kalenderweek) als een plaatje met 7 vakjes erover — elke training
// laat er één verdwijnen. Op de 7e/laatste dag van de cyclus verschijnt in plaats van de
// korte aanmoediging één van de drie eindteksten, afhankelijk van hoeveel van de 7
// trainingen zijn gelukt. Na 5 seconden gaat het vanzelf terug naar "Vandaag" (met een
// knop ernaast voor wie liever zelf doorgaat).
export function voortgangPage({ dayInCycle, blocksRevealed }) {
  const totalBlocks = 7;
  const isLastDay = dayInCycle === totalBlocks;

  let messageTitle;
  let messageBody;
  if (isLastDay) {
    if (blocksRevealed === 7) {
      messageTitle = 'Compleet!';
      messageBody = 'Super gedaan! Je hebt deze week al je gewrichten en spieren er omheen aandacht gegeven.';
    } else if (blocksRevealed >= 4) {
      messageTitle = 'Trots op je';
      messageBody = 'Ik ben trots op je. Je was deze week lekker op weg. Volgende week een nieuwe kans om 7 trainingen achter elkaar te doen.';
    } else {
      messageTitle = 'Lekker bezig';
      messageBody = 'Je bent lekker bezig! Probeer een vast moment van de dag in te plannen om je gewrichten en spieren wat aandacht te geven.';
    }
  } else {
    const remaining = totalBlocks - blocksRevealed;
    messageTitle = `Dag ${dayInCycle} van 7`;
    messageBody = remaining === 1 ? 'Nog 1 vakje te gaan voor je beloning!' : `Nog ${remaining} vakjes te gaan voor je beloning!`;
  }

  let blocksHtml = '';
  for (let i = 0; i < totalBlocks; i++) {
    const covered = i >= blocksRevealed;
    blocksHtml += `<div style="flex:1;background:${COLORS.teal900};opacity:${covered ? 1 : 0};${i > 0 ? `border-left:2px solid ${COLORS.cream};` : ''}"></div>`;
  }

  // Tijdelijke plaatsvervanger totdat er een eigen foto/afbeelding is aangeleverd — zelf
  // getekend in de bestaande huisstijlkleuren (teal/koraal/crème), zodat het geheel er nu
  // al compleet uitziet en straks zonder codewijziging vervangen kan worden door een
  // echte foto (gewoon de src van de afbeelding aanpassen).
  const placeholderImage = `<svg viewBox="0 0 400 300" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" style="display:block;">
    <rect width="400" height="300" fill="${COLORS.teal100}"/>
    <circle cx="200" cy="110" r="55" fill="${COLORS.coral600}"/>
    <path d="M0,220 Q100,165 200,210 T400,195 V300 H0 Z" fill="${COLORS.teal700}"/>
    <path d="M0,260 Q120,215 240,250 T400,240 V300 H0 Z" fill="${COLORS.teal900}"/>
  </svg>`;

  const body = `
  <div style="min-height:100vh;display:flex;flex-direction:column;background:${COLORS.cream};padding-bottom:64px;">
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px;max-width:420px;margin:0 auto;width:100%;">
      <div style="font-size:15px;font-weight:700;color:${COLORS.inkSoft};text-transform:uppercase;letter-spacing:0.06em;">Jouw cyclus</div>
      <div style="width:100%;aspect-ratio:4/3;border-radius:20px;overflow:hidden;position:relative;margin-top:14px;box-shadow:0 2px 10px rgba(0,0,0,0.08);">
        <div style="position:absolute;top:0;right:0;bottom:0;left:0;">${placeholderImage}</div>
        <div style="position:absolute;top:0;right:0;bottom:0;left:0;display:flex;">${blocksHtml}</div>
      </div>
      <div style="font-size:22px;font-weight:900;margin-top:24px;color:${COLORS.teal900};">${esc(messageTitle)}</div>
      <div style="font-size:17px;font-weight:600;color:${COLORS.inkSoft};margin-top:10px;line-height:1.5;">${esc(messageBody)}</div>
      <a href="/vandaag" style="margin-top:26px;display:inline-flex;align-items:center;justify-content:center;height:52px;padding:0 30px;border-radius:16px;background:${COLORS.teal700};color:${COLORS.white};font-size:15px;font-weight:800;text-decoration:none;">Verder</a>
    </div>
  </div>${demoFooter()}`;

  return layout({ title: 'Jouw voortgang', body, extraHead: '<meta http-equiv="refresh" content="5;url=/vandaag">' });
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
      <div style="display:flex;align-items:center;gap:8px;">${logoMark(30)}<div style="font-weight:800;font-size:16px;color:${COLORS.teal900};">DailyFit</div></div>
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
      <div style="display:flex;align-items:center;gap:10px;">${logoMark(32)}<div style="font-weight:900;font-size:18px;color:${COLORS.teal900};">DailyFit — Beheer</div></div>
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
        <div style="font-size:16px;font-weight:800;">${esc(d.joint)}oefeningen ${videoStatusBadge(d.video_status)}</div>
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
  // Vergelijk als kalenderdatums (Nederlandse tijd), niet als momenten in de tijdzone van de
  // server zelf — zie de toelichting bij APP_TIMEZONE in helpers.js.
  const expired = isoDateLocal(u.paid_until) < todayIso();
  return expired
    ? `<span style="background:#FBEDD3;color:${COLORS.amber600};padding:2px 8px;border-radius:999px;font-size:11px;font-weight:800;">Verlopen sinds ${fmtDateLong(u.paid_until)}</span>`
    : `<span style="background:${COLORS.teal100};color:${COLORS.teal900};padding:2px 8px;border-radius:999px;font-size:11px;font-weight:800;">Actief tot ${fmtDateLong(u.paid_until)}</span>`;
}

// Toont per senior hoevaak in totaal getraind is, en welk percentage dat is van het
// aantal dagen dat diegene had kúnnen trainen (vanaf aanmelden tot en met vandaag).
function trainingStatsLine(u) {
  if (u.role === 'admin' || !u.trainingStats) return '';
  const { completed, possible, percent } = u.trainingStats;
  const dagenWoord = possible === 1 ? 'dag' : 'dagen';
  return `<div style="font-size:12px;font-weight:700;color:${COLORS.teal900};margin-top:4px;">${completed}x getraind &middot; ${percent}% (van ${possible} ${dagenWoord} sinds aanmelden)</div>`;
}

export function usersPage({ users, error }) {
  const rows = users.map((u) => `
    <div style="padding:14px 16px;border:1px solid ${COLORS.border};border-radius:14px;background:${COLORS.white};margin-bottom:10px;">
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <div>
          <div style="font-size:15px;font-weight:800;">${esc(u.display_name)}</div>
          <div style="font-size:12px;font-weight:600;color:${COLORS.inkSoft};">@${esc(u.username)}${u.role !== 'admin' && u.phone_display ? ' &middot; ' + esc(u.phone_display) : ''}</div>
          ${paidStatusBadge(u)}
          ${trainingStatsLine(u)}
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
