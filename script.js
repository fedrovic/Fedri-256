/* ========= UTIL ========= */
const $ = (sel, ctx=document) => ctx.querySelector(sel);

/* ========= LIKE (persist + turns red) ========= */
const likeBtn   = $("#likeBtn");
const likeCount = $("#likeCount");
const LIKE_COUNT_KEY = "fa_like_count";
const LIKED_FLAG_KEY = "fa_user_liked";

// initialize
let count = parseInt(localStorage.getItem(LIKE_COUNT_KEY) || "0", 10);
let liked = localStorage.getItem(LIKED_FLAG_KEY) === "1";

function renderLike() {
  likeCount.textContent = String(count);
  if (liked) {
    likeBtn.classList.add("liked");
    likeBtn.textContent = "❤️";           // red heart
  } else {
    likeBtn.classList.remove("liked");
    likeBtn.textContent = "🤍";           // outline heart
  }
}
renderLike();

likeBtn?.addEventListener("click", () => {
  // toggle like with persistence (browser-local)
  if (liked) { count = Math.max(0, count - 1); liked = false; }
  else       { count += 1; liked = true; }
  localStorage.setItem(LIKE_COUNT_KEY, String(count));
  localStorage.setItem(LIKED_FLAG_KEY, liked ? "1" : "0");
  renderLike();
});

/* ========= COMMENTS (persist locally) ========= */
const commentForm   = $("#commentForm");
const commentsList  = $("#commentsList");
const viewComments  = $("#viewCommentsBtn");
const COMMENTS_KEY  = "fa_comments";

function getComments(){ try{ return JSON.parse(localStorage.getItem(COMMENTS_KEY) || "[]"); }catch{ return []; } }
function saveComments(arr){ localStorage.setItem(COMMENTS_KEY, JSON.stringify(arr)); }
function renderComments() {
  const arr = getComments();
  commentsList.innerHTML = "";
  arr.forEach(t => {
    const d = document.createElement("div");
    d.className = "comment-item";
    d.textContent = t;
    commentsList.appendChild(d);
  });
}

viewComments?.addEventListener("click", () => {
  const isHidden = getComputedStyle(commentsList).display === "none";
  commentsList.style.display = isHidden ? "block" : "none";
  if (isHidden) renderComments();
});

commentForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  const ta = commentForm.querySelector("textarea");
  const txt = (ta.value || "").trim();
  if (!txt) return;
  const arr = getComments(); arr.unshift(txt); saveComments(arr);
  ta.value = ""; renderComments(); commentsList.style.display = "block";
});

/* ========= VISITOR COUNTER (local demo) ========= */
const visitorCount = $("#visitorCount");
if (visitorCount){
  const key = "fa_visits";
  const v = parseInt(localStorage.getItem(key) || "0", 10) + 1;
  localStorage.setItem(key, String(v));
  visitorCount.textContent = String(v);
}

/* ========= MUSIC ========= */
const songSelector = $("#songSelector");
const musicPlayer  = $("#musicPlayer");
songSelector?.addEventListener("change", () => {
  const v = songSelector.value;
  if (v && v !== "none") { musicPlayer.src = v; musicPlayer.play().catch(()=>{}); }
  else { musicPlayer.pause(); musicPlayer.removeAttribute("src"); }
});

/* ========= SHARE (optional) ========= */
const shareBtn = $("#shareBtn");
shareBtn?.addEventListener("click", async () => {
  if (navigator.share) {
    try{
      await navigator.share({title:"Fred Akunzire | Portfolio", text:"Check out this portfolio!", url:location.href});
    }catch{}
  }else{
    alert("Sharing is not supported on this browser.");
  }
});

/* ========= FRED AI CHATBOT ========= */
// Elements
const botToggle   = $("#chatbotToggle");
const botWindow   = $("#chatbot");
const botClose    = $("#chatbotClose");
const botForm     = $("#chatbotForm");
const botInput    = $("#chatbotText");
const botMsgs     = $("#chatbotMessages");

// Open/close
botToggle?.addEventListener("click", ()=>{ botWindow.style.display = "flex"; botInput.focus(); });
botClose?.addEventListener("click",  ()=>{ botWindow.style.display = "none"; });
document.addEventListener("keydown", (e)=>{ if(e.key==="Escape") botWindow.style.display="none"; });

// Helpers
function appendMsg(text, who="bot"){ // who: 'bot' | 'user'
  const d = document.createElement("div");
  d.className = who; d.textContent = text;
  botMsgs.appendChild(d);
  botMsgs.scrollTop = botMsgs.scrollHeight;
}
function showTyping(){
  const t = document.createElement("div");
  t.className = "bot typing";
  t.textContent = "Fred AI is thinking…";
  botMsgs.appendChild(t);
  botMsgs.scrollTop = botMsgs.scrollHeight;
  return t;
}

// Simple intent analysis (rule-based “reasoning”)
function analyzeIntent(raw){
  const text = raw.toLowerCase();

  const score = (needles)=>needles.reduce((s,w)=>s+(text.includes(w)?1:0),0);

  const intents = [
    {name:"greeting",   s:score(["hello","hi","hey","good morning","good afternoon"])},
    {name:"projects",   s:score(["project","portfolio website","login","built","work"])},
    {name:"music",      s:score(["music","song","play","audio"])},
    {name:"contact",    s:score(["contact","email","whatsapp","hire","reach"])},
    {name:"about",      s:score(["who are you","about","student","software engineering"])},
    {name:"help",       s:score(["help","how","guide","where"])},
    {name:"like",       s:score(["like","heart","love"])},
    {name:"nav",        s:score(["navigate","where is","section","scroll"])},
  ];

  intents.sort((a,b)=>b.s-a.s);
  const top = intents[0];
  return { intent: top.name, confidence: top.s };
}

function respondByIntent(intent, input){
  switch(intent){
    case "greeting":
      return "Hello! I’m **Fred AI** 🤖. Ask me about Projects, Music, or how to Contact Fred.";
    case "projects":
      return "You’ll find the projects under **Projects** — “Personal Portfolio Website” and “Login Page UI”.";
    case "music":
      return "Go to the **Music** section, pick a song from the dropdown, and hit play 🎵.";
    case "contact":
      return "Use the **Contact** form or the **WhatsApp** button on the Contact section. I hope that helps!";
    case "about":
      return "This portfolio belongs to **Fred Akunzire**, a Software Engineering student interested in web development, UI design, and emerging technologies.";
    case "help":
      return "I can help you navigate. Try: “go to projects”, “how to play music”, or “how can I contact you?”.";
    case "like":
      return "Tap the heart button in **Interact**. It turns red and the count is saved even after refreshing.";
    case "nav":
      return "Use the top navigation links — About, Projects, Music, Contact — or tell me which section to take you to.";
    default:
      // Low confidence → ask a clarifying question
      return "I’m not fully sure what you mean 🤔. Would you like info about Projects, Music, or Contact?";
  }
}

// Form submit
botForm?.addEventListener("submit", (e)=>{
  e.preventDefault();
  const msg = botInput.value.trim();
  if(!msg) return;

  appendMsg(msg, "user");
  botInput.value = "";

  const thinkingEl = showTyping();
  setTimeout(()=>{
    thinkingEl.remove();
    const { intent, confidence } = analyzeIntent(msg);

    // simple “reasoning”: if user asks to go to a section, scroll them there
    if (confidence > 0 && /about|project|music|contact/.test(msg.toLowerCase())) {
      const id = /about/.test(msg) ? "#about" :
                 /project/.test(msg) ? "#projects" :
                 /music/.test(msg) ? "#music" : "#contact";
      const el = $(id);
      if (el) el.scrollIntoView({behavior:"smooth", block:"start"});
    }

    appendMsg(respondByIntent(intent, msg), "bot");
  }, 550);
});
