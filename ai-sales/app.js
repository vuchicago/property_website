import { authFetch, getCurrentUserToken } from "../auth-client.js";

const canvas = document.querySelector("#avatarCanvas");
const avatarStage = document.querySelector(".avatar-stage");
const kidsActivityCard = document.querySelector("#kidsActivityCard");
const kidsActivityType = document.querySelector("#kidsActivityType");
const kidsActivityPrompt = document.querySelector("#kidsActivityPrompt");
const kidsActivityAnswer = document.querySelector("#kidsActivityAnswer");
const statusDot = document.querySelector("#statusDot");
const statusText = document.querySelector("#statusText");
const modeLabel = document.querySelector("#modeLabel");
const caption = document.querySelector("#caption");
const userInput = document.querySelector("#userInput");
const scriptInput = document.querySelector("#scriptInput");
const voiceSelect = document.querySelector("#voiceSelect");
const expressionSelect = document.querySelector("#expressionSelect");
const rateInput = document.querySelector("#rateInput");
const pitchInput = document.querySelector("#pitchInput");
const cameraXInput = document.querySelector("#cameraXInput");
const cameraYInput = document.querySelector("#cameraYInput");
const cameraDistanceInput = document.querySelector("#cameraDistanceInput");
const cameraAngleInput = document.querySelector("#cameraAngleInput");
const cameraResetButton = document.querySelector("#cameraResetButton");
const repVideo = document.querySelector("#repVideo");
const cameraButton = document.querySelector("#cameraButton");
const personalitySelect = document.querySelector("#personalitySelect");
const autoConversationButton = document.querySelector("#autoConversationButton");
const listenButton = document.querySelector("#listenButton");
const stopListenButton = document.querySelector("#stopListenButton");
const roleplayButton = document.querySelector("#roleplayButton");
const generateButton = document.querySelector("#generateButton");
const speakButton = document.querySelector("#speakButton");
const stopButton = document.querySelector("#stopButton");
const demoButton = document.querySelector("#demoButton");
const rendererStatus = document.querySelector("#rendererStatus");
const modelStatus = document.querySelector("#modelStatus");
const ttsStatus = document.querySelector("#ttsStatus");
const syncStatus = document.querySelector("#syncStatus");
const visemeStatus = document.querySelector("#visemeStatus");
const logPanel = document.querySelector("#logPanel");
const nervousnessScoreOutput = document.querySelector("#nervousnessScore");
const nervousnessMeter = document.querySelector("#nervousnessMeter");
const confidenceScoreOutput = document.querySelector("#confidenceScore");
const confidenceMeter = document.querySelector("#confidenceMeter");
const eyeContactScoreOutput = document.querySelector("#eyeContactScore");
const movementScoreOutput = document.querySelector("#movementScore");
const paceScoreOutput = document.querySelector("#paceScore");
const stutterScoreOutput = document.querySelector("#stutterScore");
const nervousnessCue = document.querySelector("#nervousnessCue");

const demos = [
  {
    text: "That makes sense. What would you need to see to feel confident your reps will use it?",
    expression: "curious",
  },
  {
    text: "A small improvement in follow up speed could pay for this in under ninety days.",
    expression: "confident",
  },
  {
    text: "I hear the concern. Is the issue budget timing, or confidence in adoption?",
    expression: "concerned",
  },
  {
    text: "Great question. Let me show you the simplest way to evaluate the return.",
    expression: "friendly",
  },
];

const AVATAR_MODELS = [
  {
    name: "John business coach",
    url: "./assets/john.glb",
  },
  {
    name: "MPFB remote fallback",
    url: "https://raw.githubusercontent.com/met4citizen/TalkingHead/main/avatars/mpfb.glb",
  },
  {
    name: "Avaturn human",
    url: "https://raw.githubusercontent.com/met4citizen/TalkingHead/main/avatars/avaturn.glb",
  },
  {
    name: "Ready Player Me fallback",
    url: "https://cdn.jsdelivr.net/gh/met4citizen/TalkingHead@1.7/avatars/brunette.glb",
  },
];

const VISEMES = {
  sil: { open: 0.01, width: 0.32, round: 0, teeth: 0, tongue: 0, press: 0 },
  PP: { open: 0.008, width: 0.28, round: 0.08, teeth: 0, tongue: 0, press: 1 },
  FF: { open: 0.13, width: 0.52, round: 0, teeth: 0.82, tongue: 0, press: 0.12 },
  TH: { open: 0.25, width: 0.5, round: 0, teeth: 0.42, tongue: 0.84, press: 0 },
  DD: { open: 0.14, width: 0.48, round: 0.03, teeth: 0.26, tongue: 0.2, press: 0 },
  kk: { open: 0.2, width: 0.52, round: 0.02, teeth: 0.14, tongue: 0, press: 0 },
  CH: { open: 0.18, width: 0.44, round: 0.22, teeth: 0.42, tongue: 0, press: 0 },
  SS: { open: 0.08, width: 0.62, round: 0.02, teeth: 0.78, tongue: 0, press: 0 },
  nn: { open: 0.14, width: 0.48, round: 0.02, teeth: 0.28, tongue: 0.28, press: 0 },
  RR: { open: 0.22, width: 0.38, round: 0.46, teeth: 0.08, tongue: 0, press: 0 },
  aa: { open: 0.74, width: 0.66, round: 0.03, teeth: 0.06, tongue: 0.1, press: 0 },
  E: { open: 0.3, width: 0.78, round: 0, teeth: 0.24, tongue: 0, press: 0 },
  I: { open: 0.2, width: 0.74, round: 0, teeth: 0.44, tongue: 0, press: 0 },
  O: { open: 0.48, width: 0.4, round: 0.7, teeth: 0.04, tongue: 0, press: 0 },
  U: { open: 0.28, width: 0.28, round: 0.88, teeth: 0, tongue: 0, press: 0 },
};

const EXPRESSIONS = {
  neutral: { smile: 0.06, browLift: 0, browInner: 0, browAsym: 0, browDown: 0, eye: 0.95, squint: 0, sneer: 0, mouthSide: 0, tilt: 0 },
  friendly: { smile: 0.5, browLift: 0.04, browInner: 0, browAsym: 0, browDown: 0, eye: 0.97, squint: 0.08, sneer: 0, mouthSide: 0, tilt: -0.01 },
  happy: { smile: 0.72, browLift: 0.08, browInner: 0, browAsym: 0, browDown: 0, eye: 0.93, squint: 0.18, sneer: 0, mouthSide: 0, tilt: -0.015 },
  curious: { smile: 0.24, browLift: 0.18, browInner: 0.02, browAsym: 0.3, browDown: 0, eye: 1, squint: 0.02, sneer: 0, mouthSide: 0.04, tilt: 0.05 },
  confident: { smile: 0.34, browLift: -0.02, browInner: 0, browAsym: -0.06, browDown: 0.04, eye: 0.9, squint: 0.1, sneer: 0, mouthSide: 0, tilt: -0.025 },
  concerned: { smile: -0.14, browLift: 0.05, browInner: 0.34, browAsym: 0.05, browDown: 0.06, eye: 0.93, squint: 0.02, sneer: 0, mouthSide: 0, tilt: 0.025 },
  doubtful: { smile: -0.05, browLift: 0.1, browInner: 0.12, browAsym: 0.42, browDown: 0.08, eye: 0.88, squint: 0.14, sneer: 0.02, mouthSide: 0.18, tilt: 0.06 },
  disappointed: { smile: -0.34, browLift: -0.04, browInner: 0.22, browAsym: 0, browDown: 0.18, eye: 0.82, squint: 0.08, sneer: 0, mouthSide: 0, tilt: 0.035 },
  angry: { smile: -0.24, browLift: -0.14, browInner: 0.04, browAsym: 0, browDown: 0.52, eye: 0.76, squint: 0.34, sneer: 0.14, mouthSide: 0, tilt: -0.035 },
  scornful: { smile: -0.06, browLift: -0.08, browInner: 0, browAsym: -0.22, browDown: 0.28, eye: 0.8, squint: 0.28, sneer: 0.42, mouthSide: -0.24, tilt: -0.04 },
};

const state = {
  speaking: false,
  utterance: null,
  expression: "friendly",
  viseme: "sil",
  visemeMix: [{ viseme: "sil", weight: 1 }],
  speechEnergy: 0,
  audioEnergy: 0,
  sequence: [],
  wordAnchors: [],
  sequenceStart: 0,
  sequenceCursor: 0,
  sequenceDuration: 0,
  lastBoundaryChar: -1,
  mouth: { ...VISEMES.sil, smile: EXPRESSIONS.friendly.smile },
  mouthTarget: { ...VISEMES.sil, smile: EXPRESSIONS.friendly.smile },
  blinkStart: 0,
  nextBlink: performance.now() + 1800,
  gazeX: 0,
  gazeY: 0,
  gazeTargetX: 0,
  gazeTargetY: 0,
  nextGaze: performance.now() + 900,
};

let THREE;
let GLTFLoader;
let RoomEnvironment;
let renderer;
let scene;
let camera;
let cameraBase = null;
let avatarRoot;
let fallbackAvatarRoot;
let headGroup;
let rig = {};
let voices = [];
let voiceChoices = {};
let activeAudio = null;
let activeAudioContext = null;
let activeAudioAnalyser = null;
let activeAudioFrame = null;
let speechRunId = 0;
let salesRoleGuide = "";
let activePersonality = "sales";
let salesSettings = {
  language: "en-US",
  deepseekModel: "deepseek/deepseek-v4-flash",
  deepseekTurnModel: "deepseek/deepseek-v4-flash",
  preferredVoice: "britishMale",
  ttsProvider: "cloudflare",
  ttsModel: "@cf/deepgram/aura-2-en",
  ttsSpeaker: "apollo",
  doneProbability: 0.45,
  maxCoachTokens: 80,
  conversationTurns: 2,
  kidsModeFastLocalReplies: "true",
  autoPauseMs: 200,
  autoForceTurnMs: 450,
  autoLocalPauseMinWords: 2,
  autoRecorderSilenceMs: 350,
  autoRecorderMinSpeechMs: 350,
  autoRecorderMaxSegmentMs: 7000,
  autoRecorderRmsThreshold: 0.035,
  autoPreferRecorderMode: "false",
  autoUseAdaptiveSpeechGate: "true",
  autoNoiseFloorLearningMs: 1200,
  autoSpeechRmsMultiplier: 2.6,
  autoSpeechStartFrames: 3,
  autoSpeechEndFrames: 10,
  autoChromeEnergyGate: "false",
  autoChromeEnergyGraceMs: 900,
  autoMinMeaningfulWords: 2,
  autoMinRecognitionConfidence: 0.45,
  autoListenBeforeSpeechEndMs: 500,
  avatarEchoCooldownMs: 700,
  fluxEnabled: "true",
  fluxEotThreshold: 0.7,
  fluxEagerEotThreshold: 0.55,
  fluxEotTimeoutMs: 4000,
  fluxTurnGraceMs: 550,
};
let recognition = null;
let listening = false;
let mediaRecorder = null;
let recordingStream = null;
let recordingChunks = [];
let recording = false;
let repStream = null;
let autoConversation = false;
let autoRecognition = null;
let autoUsingRecorderMode = false;
let autoTurnBusy = false;
let autoTurnPending = false;
let autoSpeechStarting = false;
let autoTranscriptBuffer = "";
let autoFinalTranscript = "";
let autoInterimTranscript = "";
let autoPauseTimer = null;
let autoForceTurnTimer = null;
let autoEarlyListenTimer = null;
let autoRestartTimer = null;
let autoRecorder = null;
let autoRecorderStream = null;
let autoRecorderChunks = [];
let autoAudioContext = null;
let autoAnalyser = null;
let autoMonitorFrame = null;
let autoSpeechStarted = false;
let autoSilenceStartedAt = 0;
let autoRecorderStartedAt = 0;
let autoNoiseFloorRms = 0;
let autoNoiseSamples = 0;
let autoNoiseLearningStartedAt = 0;
let autoSpeechActiveFrames = 0;
let autoSpeechSilentFrames = 0;
let autoLastVoiceEnergyAt = 0;
let autoIgnoreMicUntil = 0;
let autoPreListening = false;
let autoLastTranscriptAt = 0;
let autoLastTranscriptText = "";
let fluxSocket = null;
let fluxStream = null;
let fluxAudioContext = null;
let fluxProcessor = null;
let fluxSource = null;
let fluxSilentGain = null;
let fluxUsingLiveMode = false;
let fluxEagerTranscript = "";
let fluxTurnBuffer = "";
let fluxResponseTimer = null;
let userSelectedVoice = false;
let coachingFrameId = null;
let coachingCanvas = null;
let coachingContext = null;
let faceDetector = null;
let faceDetectorBusy = false;
let lastVideoSample = null;
let speechMetrics = {
  text: "",
  startedAt: 0,
  updatedAt: 0,
  words: 0,
  wpm: 0,
  fillerRate: 0,
  stutterRate: 0,
  paceNervousness: 0,
  stutterNervousness: 0,
};
let visualMetrics = {
  eyeContact: 0,
  movement: 0,
  movementNervousness: 0,
  gazeNervousness: 0,
  frameCount: 0,
  faceDetected: false,
};
let coachingSession = {
  transcript: "",
  lastRecordedTurn: "",
  visualSamples: 0,
  eyeContactTotal: 0,
  movementTotal: 0,
  movementNervousnessTotal: 0,
  gazeNervousnessTotal: 0,
};
const conversationTurns = [];
let pendingKidsActivity = null;
let kidsMathGameActive = false;
let kidsMathGameOffered = false;

const AUTO_MIN_TRANSCRIPT_CHARS = 3;

const VOICE_PROFILES = {
  britishMale: {
    label: "British Male",
    lang: "en-GB",
    rate: 0.93,
    pitch: 0.86,
    prefer: /google uk english male|google .*uk.*male|microsoft (ryan|george|thomas|oliver)|\b(daniel|arthur|jamie|liam|oliver|george|ryan|thomas)\b/i,
    avoid: /samantha|ava|allison|victoria|karen|jenny|aria|emma|susan|zira|hazel|moira|tessa|fiona|compact|novelty/i,
  },
  male: {
    label: "Male",
    rate: 0.92,
    pitch: 0.82,
    prefer: /microsoft (guy|david|mark)|google .*male|english .*male|\b(daniel|alex|aaron|brian|guy|david|george|mark|james|liam|oliver|fred|ralph|tom)\b/i,
    avoid: /samantha|ava|allison|victoria|karen|jenny|aria|emma|susan|zira|hazel|moira|tessa|fiona/i,
  },
  female: {
    label: "Female",
    rate: 0.96,
    pitch: 1.02,
    prefer: /microsoft (aria|jenny|zira)|google .*female|english .*female|\b(samantha|ava|allison|victoria|karen|jenny|aria|emma|susan|zira|hazel|moira|tessa|fiona)\b/i,
    avoid: /daniel|fred|ralph|tom|aaron|brian|guy|david|george|mark|james|liam|oliver/i,
  },
};

const MORPH_ALIASES = {
  blinkLeft: ["eyeBlinkLeft", "EyeBlinkLeft", "eyesClosedLeft"],
  blinkRight: ["eyeBlinkRight", "EyeBlinkRight", "eyesClosedRight"],
  browInner: ["browInnerUp", "BrowInnerUp"],
  browOuterLeft: ["browOuterUpLeft", "BrowOuterUpLeft"],
  browOuterRight: ["browOuterUpRight", "BrowOuterUpRight"],
  browDownLeft: ["browDownLeft", "BrowDownLeft"],
  browDownRight: ["browDownRight", "BrowDownRight"],
  eyeSquintLeft: ["eyeSquintLeft", "EyeSquintLeft"],
  eyeSquintRight: ["eyeSquintRight", "EyeSquintRight"],
  cheekSquintLeft: ["cheekSquintLeft", "CheekSquintLeft"],
  cheekSquintRight: ["cheekSquintRight", "CheekSquintRight"],
  eyeLookUpLeft: ["eyeLookUpLeft", "EyeLookUpLeft"],
  eyeLookUpRight: ["eyeLookUpRight", "EyeLookUpRight"],
  eyeLookDownLeft: ["eyeLookDownLeft", "EyeLookDownLeft"],
  eyeLookDownRight: ["eyeLookDownRight", "EyeLookDownRight"],
  eyeLookInLeft: ["eyeLookInLeft", "EyeLookInLeft"],
  eyeLookInRight: ["eyeLookInRight", "EyeLookInRight"],
  eyeLookOutLeft: ["eyeLookOutLeft", "EyeLookOutLeft"],
  eyeLookOutRight: ["eyeLookOutRight", "EyeLookOutRight"],
  jawOpen: ["jawOpen", "JawOpen", "mouthOpen"],
  mouthClose: ["mouthClose", "MouthClose"],
  mouthFunnel: ["mouthFunnel", "MouthFunnel"],
  mouthPucker: ["mouthPucker", "MouthPucker"],
  mouthSmileLeft: ["mouthSmileLeft", "MouthSmileLeft"],
  mouthSmileRight: ["mouthSmileRight", "MouthSmileRight"],
  mouthFrownLeft: ["mouthFrownLeft", "MouthFrownLeft"],
  mouthFrownRight: ["mouthFrownRight", "MouthFrownRight"],
  mouthStretchLeft: ["mouthStretchLeft", "MouthStretchLeft"],
  mouthStretchRight: ["mouthStretchRight", "MouthStretchRight"],
  mouthDimpleLeft: ["mouthDimpleLeft", "MouthDimpleLeft"],
  mouthDimpleRight: ["mouthDimpleRight", "MouthDimpleRight"],
  mouthLeft: ["mouthLeft", "MouthLeft"],
  mouthRight: ["mouthRight", "MouthRight"],
  mouthPressLeft: ["mouthPressLeft", "MouthPressLeft"],
  mouthPressRight: ["mouthPressRight", "MouthPressRight"],
  mouthRollUpper: ["mouthRollUpper", "MouthRollUpper"],
  mouthRollLower: ["mouthRollLower", "MouthRollLower"],
  tongueOut: ["tongueOut", "TongueOut"],
  noseSneerLeft: ["noseSneerLeft", "NoseSneerLeft"],
  noseSneerRight: ["noseSneerRight", "NoseSneerRight"],
  visemeSil: ["viseme_sil", "viseme_SIL", "sil"],
  visemePP: ["viseme_PP", "viseme_PP_0", "mouthClose"],
  visemeFF: ["viseme_FF", "viseme_ff"],
  visemeTH: ["viseme_TH", "viseme_th"],
  visemeDD: ["viseme_DD", "viseme_dd"],
  visemeKK: ["viseme_kk", "viseme_KK"],
  visemeCH: ["viseme_CH", "viseme_ch"],
  visemeSS: ["viseme_SS", "viseme_ss"],
  visemeNN: ["viseme_nn", "viseme_NN"],
  visemeRR: ["viseme_RR", "viseme_rr"],
  visemeAA: ["viseme_aa", "viseme_AA", "aa"],
  visemeE: ["viseme_E", "viseme_e", "E"],
  visemeI: ["viseme_I", "viseme_i", "I"],
  visemeO: ["viseme_O", "viseme_o", "O"],
  visemeU: ["viseme_U", "viseme_u", "U"],
};

const VISEME_MORPH = {
  sil: "visemeSil",
  PP: "visemePP",
  FF: "visemeFF",
  TH: "visemeTH",
  DD: "visemeDD",
  kk: "visemeKK",
  CH: "visemeCH",
  SS: "visemeSS",
  nn: "visemeNN",
  RR: "visemeRR",
  aa: "visemeAA",
  E: "visemeE",
  I: "visemeI",
  O: "visemeO",
  U: "visemeU",
};

function setStatus(text, tone = "idle") {
  statusText.textContent = text;
  statusDot.dataset.tone = tone;
}

function setLog(message) {
  logPanel.textContent = message || "";
}

function formatActivityType(type) {
  const labels = {
    addition: "Math",
    subtraction: "Math",
    counting: "Counting",
    letter: "Letters",
  };
  return labels[type] || "Question";
}

function hideKidsActivity() {
  pendingKidsActivity = null;
  if (avatarStage) delete avatarStage.dataset.activityVisible;
  if (kidsActivityCard) kidsActivityCard.hidden = true;
  if (kidsActivityAnswer) kidsActivityAnswer.hidden = true;
}

function showKidsActivity(activity, reveal = false) {
  if (activePersonality !== "kids" || !activity || !kidsActivityCard) return;

  pendingKidsActivity = activity;
  kidsActivityType.textContent = formatActivityType(activity.type);
  kidsActivityPrompt.textContent = activity.prompt || "";
  kidsActivityAnswer.textContent = activity.reveal || `${activity.prompt || ""} ${activity.answer || ""}`.trim();
  kidsActivityAnswer.hidden = !reveal;
  kidsActivityCard.hidden = false;
  if (avatarStage) avatarStage.dataset.activityVisible = "true";
}

async function revealPendingKidsActivity() {
  if (activePersonality !== "kids" || !pendingKidsActivity) return;

  showKidsActivity(pendingKidsActivity, true);
  setStatus("Showing answer", "ready");
  await wait(1700);
  hideKidsActivity();
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function makeKidsMathActivity() {
  const type = ["addition", "subtraction"][randomInt(0, 1)];

  if (type === "addition") {
    const left = randomInt(0, 5);
    const right = randomInt(0, 10 - left);
    const answer = left + right;
    return {
      type,
      prompt: `${left} + ${right} =`,
      answer: String(answer),
      reveal: `${left} + ${right} = ${answer}`,
      spokenQuestion: `What is ${left} plus ${right}?`,
    };
  }

  if (type === "subtraction") {
    const left = randomInt(1, 10);
    const right = randomInt(0, left);
    const answer = left - right;
    return {
      type,
      prompt: `${left} - ${right} =`,
      answer: String(answer),
      reveal: `${left} - ${right} = ${answer}`,
      spokenQuestion: `What is ${left} minus ${right}?`,
    };
  }

}

function parseChildNumber(text) {
  const cleanText = compactTranscript(text).toLowerCase();
  const digitMatch = cleanText.match(/\b([0-9]|[12][0-9]|30)\b/);
  if (digitMatch) return Number(digitMatch[1]);

  const numberWords = {
    zero: 0,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    for: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    ate: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
    thirteen: 13,
    fourteen: 14,
    fifteen: 15,
    sixteen: 16,
    seventeen: 17,
    eighteen: 18,
    nineteen: 19,
    twenty: 20,
    thirty: 30,
  };
  if (/\btwenty one\b/.test(cleanText)) return 21;
  if (/\btwenty two\b/.test(cleanText)) return 22;
  if (/\btwenty three\b/.test(cleanText)) return 23;
  if (/\btwenty four\b/.test(cleanText)) return 24;
  if (/\btwenty five\b/.test(cleanText)) return 25;
  if (/\btwenty six\b/.test(cleanText)) return 26;
  if (/\btwenty seven\b/.test(cleanText)) return 27;
  if (/\btwenty eight\b/.test(cleanText)) return 28;
  if (/\btwenty nine\b/.test(cleanText)) return 29;

  const word = cleanText.match(/\b(zero|one|two|three|four|for|five|six|seven|eight|ate|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty)\b/)?.[1];
  return word ? numberWords[word] : null;
}

function childSaidYes(text) {
  return /\b(yes|yeah|yep|ok|okay|sure|please|play|start|again|another|more)\b/i.test(text);
}

function childSaidNo(text) {
  return /\b(no|nope|stop|done|finished|all done|not now)\b/i.test(text);
}

function childMentionedMath(text) {
  return /\b(math|game|add|plus|subtract|minus|count|number|numbers)\b/i.test(text);
}

function startKidsMathQuestion() {
  kidsMathGameActive = true;
  kidsMathGameOffered = false;
  const activity = makeKidsMathActivity();
  showKidsActivity(activity, false);
  return {
    text: `${activity.spokenQuestion} Look at the card and tell me your answer.`,
    activity,
    provider: "local-kids-math",
    model: "local-calculator",
    shouldRespond: true,
  };
}

function startKidsAbcLesson() {
  kidsMathGameActive = false;
  kidsMathGameOffered = false;
  hideKidsActivity();
  return {
    text: "Okay, let's do ABCs. A, B, C. Can you say A with me?",
    provider: "local-kids-abc",
    model: "local",
    shouldRespond: true,
  };
}

async function readJsonResponse(response) {
  const text = await response.text();
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return text ? JSON.parse(text) : {};
  }

  const preview = text
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);
  throw new Error(
    `Expected JSON from ${new URL(response.url).pathname}, got ${response.status} ${response.statusText}. ` +
      (preview ? `Response started with: ${preview}` : "The response body was empty."),
  );
}

function personalityGuidePath(personality = activePersonality) {
  return personality === "kids" ? "./kids-agent.md" : "./sales-agent.md";
}

function updatePersonalityLabels() {
  if (activePersonality === "kids") {
    scriptInput.value = "Hi, I am John. Do you want to play a math game?";
    caption.textContent = scriptInput.value;
    userInput.placeholder = "Say hi to John, count, or ask about letters.";
    roleplayButton.textContent = "Answer";
    generateButton.textContent = "Generate Answer";
    kidsMathGameOffered = true;
    return;
  }

  scriptInput.value = "Hi, I’m John. Let’s practice your discovery call.";
  caption.textContent = scriptInput.value;
  userInput.placeholder = "Ask the customer a discovery question.";
  roleplayButton.textContent = "Respond";
  generateButton.textContent = "Generate Reply";
}

async function loadSalesRoleGuide(personality = activePersonality) {
  try {
    const path = personalityGuidePath(personality);
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) throw new Error(`${path} ${response.status}`);
    salesRoleGuide = await response.text();
  } catch (error) {
    salesRoleGuide = "";
    setLog(`Role guide unavailable: ${error.message || error}`);
  }
}

async function setPersonality(personality) {
  activePersonality = personality === "kids" ? "kids" : "sales";
  if (personalitySelect) personalitySelect.value = activePersonality;
  hideKidsActivity();
  kidsMathGameActive = false;
  kidsMathGameOffered = false;
  conversationTurns.length = 0;
  autoTranscriptBuffer = "";
  resetCoachingSession();
  resetAutoUtteranceText();
  updatePersonalityLabels();
  await loadSalesRoleGuide(activePersonality);
  setLog(`Personality: ${activePersonality === "kids" ? "Kids Friend" : "Sales Customer"}`);
}

function parseSimpleYaml(text) {
  const output = {};
  String(text || "")
    .split(/\r?\n/)
    .forEach((line) => {
      const clean = line.replace(/\s+#.*$/, "").trim();
      if (!clean || clean.startsWith("#")) return;
      const match = clean.match(/^([A-Za-z0-9_-]+)\s*:\s*(.+)$/);
      if (!match) return;

      const key = match[1];
      const rawValue = match[2].trim().replace(/^["']|["']$/g, "");
      const numericValue = Number(rawValue);
      output[key] = Number.isFinite(numericValue) ? numericValue : rawValue;
    });
  return output;
}

function clampProbability(value, fallback = 0.5) {
  const number = Number(value);
  return Number.isFinite(number) ? clamp(number, 0, 1) : fallback;
}

function clampNumber(value, fallback, min, max) {
  const number = Number(value);
  return Number.isFinite(number) ? clamp(number, min, max) : fallback;
}

async function loadSalesSettings() {
  try {
    const response = await fetch("./settings.yaml", { cache: "no-store" });
    if (!response.ok) throw new Error(`settings.yaml ${response.status}`);
    const settings = parseSimpleYaml(await response.text());
    salesSettings = {
      ...salesSettings,
      ...settings,
      language: String(settings.language || salesSettings.language || "en-US"),
      deepseekModel: String(settings.deepseekModel || salesSettings.deepseekModel || "deepseek/deepseek-v4-flash"),
      deepseekTurnModel: String(settings.deepseekTurnModel || salesSettings.deepseekTurnModel || settings.deepseekModel || "deepseek/deepseek-v4-flash"),
      preferredVoice: String(settings.preferredVoice || salesSettings.preferredVoice || "britishMale"),
      ttsProvider: String(settings.ttsProvider || salesSettings.ttsProvider || "cloudflare"),
      ttsModel: String(settings.ttsModel || salesSettings.ttsModel || "@cf/deepgram/aura-2-en"),
      ttsSpeaker: String(settings.ttsSpeaker || salesSettings.ttsSpeaker || "apollo"),
      doneProbability: clampProbability(settings.doneProbability, salesSettings.doneProbability),
      maxCoachTokens: clampNumber(settings.maxCoachTokens, salesSettings.maxCoachTokens, 30, 300),
      conversationTurns: clampNumber(settings.conversationTurns, salesSettings.conversationTurns, 0, 8),
      kidsModeFastLocalReplies: String(settings.kidsModeFastLocalReplies ?? salesSettings.kidsModeFastLocalReplies),
      autoPauseMs: clampNumber(settings.autoPauseMs, salesSettings.autoPauseMs, 150, 2000),
      autoForceTurnMs: clampNumber(settings.autoForceTurnMs, salesSettings.autoForceTurnMs, 400, 5000),
      autoLocalPauseMinWords: clampNumber(settings.autoLocalPauseMinWords, salesSettings.autoLocalPauseMinWords, 2, 12),
      autoRecorderSilenceMs: clampNumber(settings.autoRecorderSilenceMs, salesSettings.autoRecorderSilenceMs, 250, 3000),
      autoRecorderMinSpeechMs: clampNumber(settings.autoRecorderMinSpeechMs, salesSettings.autoRecorderMinSpeechMs, 100, 2000),
      autoRecorderMaxSegmentMs: clampNumber(settings.autoRecorderMaxSegmentMs, salesSettings.autoRecorderMaxSegmentMs, 2000, 20000),
      autoRecorderRmsThreshold: clampNumber(settings.autoRecorderRmsThreshold, salesSettings.autoRecorderRmsThreshold, 0.005, 0.2),
      autoPreferRecorderMode: String(settings.autoPreferRecorderMode ?? salesSettings.autoPreferRecorderMode),
      autoUseAdaptiveSpeechGate: String(settings.autoUseAdaptiveSpeechGate ?? salesSettings.autoUseAdaptiveSpeechGate),
      autoNoiseFloorLearningMs: clampNumber(settings.autoNoiseFloorLearningMs, salesSettings.autoNoiseFloorLearningMs, 250, 5000),
      autoSpeechRmsMultiplier: clampNumber(settings.autoSpeechRmsMultiplier, salesSettings.autoSpeechRmsMultiplier, 1.2, 8),
      autoSpeechStartFrames: clampNumber(settings.autoSpeechStartFrames, salesSettings.autoSpeechStartFrames, 1, 12),
      autoSpeechEndFrames: clampNumber(settings.autoSpeechEndFrames, salesSettings.autoSpeechEndFrames, 2, 30),
      autoChromeEnergyGate: String(settings.autoChromeEnergyGate ?? salesSettings.autoChromeEnergyGate),
      autoChromeEnergyGraceMs: clampNumber(settings.autoChromeEnergyGraceMs, salesSettings.autoChromeEnergyGraceMs, 100, 3000),
      autoMinMeaningfulWords: clampNumber(settings.autoMinMeaningfulWords, salesSettings.autoMinMeaningfulWords, 1, 8),
      autoMinRecognitionConfidence: clampNumber(settings.autoMinRecognitionConfidence, salesSettings.autoMinRecognitionConfidence, 0, 1),
      autoListenBeforeSpeechEndMs: clampNumber(settings.autoListenBeforeSpeechEndMs, salesSettings.autoListenBeforeSpeechEndMs, 0, 2000),
      avatarEchoCooldownMs: clampNumber(settings.avatarEchoCooldownMs, salesSettings.avatarEchoCooldownMs, 0, 3000),
      fluxEnabled: String(settings.fluxEnabled ?? salesSettings.fluxEnabled),
      fluxEotThreshold: clampNumber(settings.fluxEotThreshold, salesSettings.fluxEotThreshold, 0.5, 0.9),
      fluxEagerEotThreshold: clampNumber(settings.fluxEagerEotThreshold, salesSettings.fluxEagerEotThreshold, 0.3, 0.9),
      fluxEotTimeoutMs: clampNumber(settings.fluxEotTimeoutMs, salesSettings.fluxEotTimeoutMs, 500, 60000),
      fluxTurnGraceMs: clampNumber(settings.fluxTurnGraceMs, salesSettings.fluxTurnGraceMs, 0, 4000),
    };
  } catch (error) {
    setLog(`Settings unavailable, using defaults: ${error.message || error}`);
  }
}

async function startRepCamera() {
  await ensureRepCamera();
}

async function ensureRepCamera() {
  if (repStream?.active && repVideo.srcObject === repStream) {
    if (repVideo.paused) await repVideo.play().catch(() => {});
    return true;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus("Camera unavailable", "warn");
    return false;
  }

  try {
    repStream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: "user" },
      audio: false,
    });
    repVideo.srcObject = repStream;
    await repVideo.play();
    visualMetrics = {
      eyeContact: 0,
      movement: 0,
      movementNervousness: 0,
      gazeNervousness: 0,
      frameCount: 0,
      faceDetected: false,
    };
    coachingSession.visualSamples = 0;
    coachingSession.eyeContactTotal = 0;
    coachingSession.movementTotal = 0;
    coachingSession.movementNervousnessTotal = 0;
    coachingSession.gazeNervousnessTotal = 0;
    lastVideoSample = null;
    if (!coachingFrameId) coachingFrameId = requestAnimationFrame(sampleCoachingFrame);
    setStatus("Camera ready", "ready");
    return true;
  } catch (error) {
    setStatus("Camera blocked", "warn");
    setLog(`Camera blocked: ${error.message || error}`);
    return false;
  }
}

function speechRecognitionFactory() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function ensureRecognition() {
  const Recognition = speechRecognitionFactory();
  if (!Recognition) {
    return null;
  }

  if (recognition) return recognition;

  recognition = new Recognition();
  recognition.lang = salesSettings.language || "en-US";
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    listening = true;
    listenButton.disabled = true;
    stopListenButton.disabled = false;
    setStatus("Listening", "busy");
    setLog("Listening now.");
  };

  recognition.onresult = (event) => {
    let transcript = "";
    for (let index = 0; index < event.results.length; index += 1) {
      transcript += event.results[index][0]?.transcript || "";
    }
    if (transcript.trim()) {
      userInput.value = transcript.trim();
      updateSpeechMetrics(userInput.value);
    }
  };

  recognition.onerror = (event) => {
    listening = false;
    listenButton.disabled = false;
    stopListenButton.disabled = true;
    setStatus("Listening stopped", "warn");
    setLog(`Speech recognition: ${event.error || "stopped"}`);
  };

  recognition.onend = () => {
    const transcript = userInput.value.trim();
    listening = false;
    listenButton.disabled = false;
    stopListenButton.disabled = true;
    if (transcript) {
      generateRoleplayReply(transcript, true);
    } else {
      setStatus("Avatar ready", "ready");
    }
  };

  return recognition;
}

async function startAudioRecordingFallback() {
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    setStatus("Speech unavailable", "warn");
    setLog("This browser cannot record audio for transcription. Type your line and press Respond.");
    return;
  }

  try {
    recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recordingChunks = [];
    mediaRecorder = new MediaRecorder(recordingStream);

    mediaRecorder.ondataavailable = (event) => {
      if (event.data?.size) recordingChunks.push(event.data);
    };

    mediaRecorder.onstop = async () => {
      recording = false;
      listenButton.disabled = false;
      stopListenButton.disabled = true;
      recordingStream?.getTracks().forEach(track => track.stop());
      recordingStream = null;

      if (!recordingChunks.length) {
        setStatus("No audio captured", "warn");
        return;
      }

      await transcribeRecording(new Blob(recordingChunks, { type: mediaRecorder.mimeType || "audio/webm" }));
    };

    recording = true;
    listenButton.disabled = true;
    stopListenButton.disabled = false;
    userInput.value = "";
    updateSpeechMetrics("");
    setStatus("Recording", "busy");
    setLog("Recording audio for Cloudflare Whisper transcription.");
    mediaRecorder.start();
  } catch (error) {
    recording = false;
    listenButton.disabled = false;
    stopListenButton.disabled = true;
    setStatus("Microphone blocked", "warn");
    setLog(`Microphone blocked: ${error.message || error}`);
  }
}

async function transcribeRecording(blob) {
  setStatus("Transcribing", "busy");
  setLog("Sending audio to Cloudflare Whisper.");

  try {
    const transcript = await transcribeBlob(blob);
    if (!transcript) {
      setStatus("No speech detected", "warn");
      setLog("Cloudflare Whisper did not return a transcript.");
      return;
    }

    userInput.value = transcript;
    updateSpeechMetrics(transcript);
    setLog(`transcript: ${transcript}`);
    await generateRoleplayReply(transcript, true);
  } catch (error) {
    setStatus("Transcription failed", "bad");
    setLog(`Transcription failed: ${error.message || error}`);
  }
}

async function transcribeBlob(blob) {
  const response = await authFetch("/api/ai-sales/transcribe", {
    method: "POST",
    headers: { "Content-Type": blob.type || "application/octet-stream" },
    body: blob,
  });
  const payload = await readJsonResponse(response);

  if (!response.ok) {
    throw new Error(payload.error || `Transcription failed (${response.status})`);
  }

  return String(payload.text || "").trim();
}

/*
VAD auto mode is intentionally paused, not removed. The previous flow loaded
@ricky0123/vad-web, converted speech segments to WAV, sent them to Whisper, and
then called DeepSeek. It worked, but waiting for audio endpointing plus Whisper
made the turn feel slow. If we revisit VAD, restore the script tags in
index.html and rebuild the MicVAD.new(...) segment handler around transcribeBlob.
*/

function clearAutoTimers() {
  if (autoPauseTimer) {
    window.clearTimeout(autoPauseTimer);
    autoPauseTimer = null;
  }
  if (autoForceTurnTimer) {
    window.clearTimeout(autoForceTurnTimer);
    autoForceTurnTimer = null;
  }
  if (autoEarlyListenTimer) {
    window.clearTimeout(autoEarlyListenTimer);
    autoEarlyListenTimer = null;
  }
  if (autoRestartTimer) {
    window.clearTimeout(autoRestartTimer);
    autoRestartTimer = null;
  }
}

function stopAutoRecorderResources() {
  if (autoMonitorFrame) {
    cancelAnimationFrame(autoMonitorFrame);
    autoMonitorFrame = null;
  }

  if (autoRecorder && autoRecorder.state !== "inactive") {
    try {
      autoRecorder.stop();
    } catch {
      // Recorder may already be stopped.
    }
  }

  autoRecorderStream?.getTracks().forEach(track => track.stop());
  autoRecorderStream = null;
  autoRecorder = null;
  autoRecorderChunks = [];
  autoSpeechStarted = false;
  autoSilenceStartedAt = 0;
  autoRecorderStartedAt = 0;
  resetAutoSpeechGate();

  if (autoAudioContext && autoAudioContext.state !== "closed") {
    autoAudioContext.close().catch(() => {});
  }
  autoAudioContext = null;
  autoAnalyser = null;
}

function compactTranscript(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function wordOverlapRatio(a, b) {
  const leftWords = String(a || "").toLowerCase().match(/[a-z']+/g) || [];
  const rightWords = String(b || "").toLowerCase().match(/[a-z']+/g) || [];
  if (!leftWords.length || !rightWords.length) return 0;

  const rightCounts = new Map();
  rightWords.forEach((word) => {
    rightCounts.set(word, (rightCounts.get(word) || 0) + 1);
  });

  let matches = 0;
  leftWords.forEach((word) => {
    const count = rightCounts.get(word) || 0;
    if (!count) return;
    matches += 1;
    rightCounts.set(word, count - 1);
  });

  return matches / leftWords.length;
}

function transcriptQuality(text, confidence = 1) {
  const cleanText = compactTranscript(text).toLowerCase();
  const avatarText = compactTranscript(scriptInput.value).toLowerCase();
  const words = cleanText.match(/[a-z']+/g) || [];
  const uniqueWords = new Set(words);
  const noisePhrase = /\b(static|background noise|noise|silence|music|typing|beep|buzzing|humming|breathing|coughing|laughing|applause|inaudible|unintelligible)\b/i.test(cleanText);
  const repeatedJunk = words.length >= 3 && uniqueWords.size <= 1;
  const minWords = activePersonality === "kids" ? 1 : salesSettings.autoMinMeaningfulWords;
  const minConfidence = salesSettings.autoMinRecognitionConfidence;
  const tooShort = words.length < minWords;
  const lowConfidence = Number.isFinite(confidence) && confidence > 0 && confidence < minConfidence;
  const onlyFiller = words.length > 0 && words.every(word => /^(um+|uh+|ah+|er+|hmm+|mm+|oh)$/.test(word));
  const avatarEcho = Boolean(
    avatarText &&
      cleanText.length > 8 &&
      (state.speaking || Date.now() < autoIgnoreMicUntil) &&
      (avatarText.includes(cleanText) || wordOverlapRatio(cleanText, avatarText) > 0.72),
  );
  const meaningful = !noisePhrase && !repeatedJunk && !tooShort && !lowConfidence && !onlyFiller && !avatarEcho;
  return {
    meaningful,
    reason: noisePhrase
      ? "noise phrase"
      : repeatedJunk
        ? "repeated noise"
        : tooShort
          ? "too short"
          : lowConfidence
            ? "low confidence"
            : onlyFiller
              ? "filler only"
              : avatarEcho
                ? "avatar echo"
                : "speech",
    words: words.length,
    confidence,
  };
}

function resetAutoSpeechGate() {
  autoNoiseFloorRms = 0;
  autoNoiseSamples = 0;
  autoNoiseLearningStartedAt = performance.now();
  autoSpeechActiveFrames = 0;
  autoSpeechSilentFrames = 0;
  autoLastVoiceEnergyAt = 0;
}

function adaptiveSpeechGateEnabled() {
  return isEnabledSetting(salesSettings.autoUseAdaptiveSpeechGate);
}

function chromeEnergyGateEnabled() {
  return isEnabledSetting(salesSettings.autoChromeEnergyGate);
}

function preferRecorderModeEnabled() {
  return isEnabledSetting(salesSettings.autoPreferRecorderMode);
}

function fluxEnabled() {
  return isEnabledSetting(salesSettings.fluxEnabled);
}

function resampleToPcm16(input, inputRate, outputRate = 16000) {
  const outputLength = Math.max(1, Math.round(input.length * outputRate / inputRate));
  const output = new Int16Array(outputLength);
  const ratio = input.length / outputLength;

  for (let index = 0; index < outputLength; index += 1) {
    const start = Math.floor(index * ratio);
    const end = Math.max(start + 1, Math.floor((index + 1) * ratio));
    let sum = 0;
    for (let sampleIndex = start; sampleIndex < end && sampleIndex < input.length; sampleIndex += 1) {
      sum += input[sampleIndex];
    }
    const sample = Math.max(-1, Math.min(1, sum / Math.max(1, end - start)));
    output[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return output.buffer;
}

function stopFluxResources({ closeSocket = true } = {}) {
  fluxUsingLiveMode = false;
  fluxEagerTranscript = "";
  fluxTurnBuffer = "";
  if (fluxResponseTimer) window.clearTimeout(fluxResponseTimer);
  fluxResponseTimer = null;

  if (fluxProcessor) {
    fluxProcessor.onaudioprocess = null;
    fluxProcessor.disconnect();
  }
  fluxSource?.disconnect();
  fluxSilentGain?.disconnect();
  fluxStream?.getTracks().forEach(track => track.stop());
  if (fluxAudioContext && fluxAudioContext.state !== "closed") {
    fluxAudioContext.close().catch(() => {});
  }
  if (closeSocket && fluxSocket) {
    try {
      if (fluxSocket.readyState === WebSocket.OPEN) {
        fluxSocket.send(JSON.stringify({ type: "CloseStream" }));
      }
      fluxSocket.close();
    } catch {
      // The socket may already be closing.
    }
  }

  fluxProcessor = null;
  fluxSource = null;
  fluxSilentGain = null;
  fluxStream = null;
  fluxAudioContext = null;
  fluxSocket = null;
}

async function handleFluxTurn(message) {
  if (!autoConversation || message?.type !== "TurnInfo") return;
  const transcript = compactTranscript(message.transcript);

  if (message.event === "StartOfTurn") {
    if (fluxResponseTimer) {
      window.clearTimeout(fluxResponseTimer);
      fluxResponseTimer = null;
    }
    if (state.speaking || autoSpeechStarting) stopSpeaking(true, "Listening");
    noteAutoSpeechActivity();
    return;
  }

  if (transcript) {
    userInput.value = transcript;
    updateSpeechMetrics(transcript);
  }

  if (message.event === "Update") {
    if (transcript) setStatus("Listening", "busy");
    return;
  }

  if (message.event === "EagerEndOfTurn") {
    fluxEagerTranscript = transcript;
    setStatus("Almost ready", "busy");
    return;
  }

  if (message.event === "TurnResumed") {
    fluxEagerTranscript = "";
    setStatus("Listening", "busy");
    return;
  }

  if (message.event !== "EndOfTurn" || !transcript) return;
  fluxTurnBuffer = compactTranscript(`${fluxTurnBuffer} ${transcript}`);
  userInput.value = fluxTurnBuffer;
  updateSpeechMetrics(fluxTurnBuffer);
  fluxEagerTranscript = "";
  setStatus("Listening for more", "busy");

  if (fluxResponseTimer) window.clearTimeout(fluxResponseTimer);
  fluxResponseTimer = window.setTimeout(() => {
    fluxResponseTimer = null;
    void respondToFluxTurn();
  }, salesSettings.fluxTurnGraceMs);
}

async function respondToFluxTurn() {
  if (!autoConversation || autoTurnBusy) return;
  const transcript = compactTranscript(fluxTurnBuffer);
  if (!transcript) return;
  const quality = transcriptQuality(transcript);
  if (!quality.meaningful) {
    fluxTurnBuffer = "";
    setStatus("Listening", "ready");
    setLog(`Flux ignored likely background noise: ${quality.reason}`);
    return;
  }

  fluxTurnBuffer = "";
  fluxEagerTranscript = "";
  autoTurnBusy = true;
  setStatus("Thinking", "busy");
  setLog(`Flux end of turn: ${transcript}`);
  try {
    await requestCustomerReply({ scenario: transcript, autoSpeak: true, forceRespond: true });
  } catch (error) {
    if (autoConversation) {
      setStatus("Conversation failed", "bad");
      setLog(`Flux conversation failed: ${error.message || error}`);
    }
  } finally {
    autoTurnBusy = false;
    if (autoConversation && !state.speaking && !autoSpeechStarting) setStatus("Listening", "ready");
  }
}

async function startFluxConversation() {
  if (!navigator.mediaDevices?.getUserMedia || !(window.AudioContext || window.webkitAudioContext)) {
    throw new Error("Live microphone audio is unavailable.");
  }

  await ensureRepCamera();
  fluxStream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });

  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const params = new URLSearchParams({
    eot_threshold: String(salesSettings.fluxEotThreshold),
    eager_eot_threshold: String(salesSettings.fluxEagerEotThreshold),
    eot_timeout_ms: String(salesSettings.fluxEotTimeoutMs),
    access_token: await getCurrentUserToken(),
  });
  fluxSocket = new WebSocket(`${protocol}//${location.host}/api/ai-sales/flux?${params}`);
  fluxSocket.binaryType = "arraybuffer";

  await new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error("Flux connection timed out.")), 8000);
    fluxSocket.onopen = () => {
      window.clearTimeout(timeout);
      resolve();
    };
    fluxSocket.onerror = () => {
      window.clearTimeout(timeout);
      reject(new Error("Flux WebSocket could not connect."));
    };
  });

  fluxSocket.onmessage = event => {
    if (typeof event.data !== "string") return;
    try {
      void handleFluxTurn(JSON.parse(event.data));
    } catch {
      // Ignore non-JSON service frames.
    }
  };
  fluxSocket.onclose = () => {
    if (!autoConversation || !fluxUsingLiveMode) return;
    setLog("Flux disconnected. Auto mode stopped; restart Auto to reconnect.");
    stopAutoConversation();
  };

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  fluxAudioContext = new AudioContextClass({ sampleRate: 48000 });
  await fluxAudioContext.resume();
  fluxSource = fluxAudioContext.createMediaStreamSource(fluxStream);
  fluxProcessor = fluxAudioContext.createScriptProcessor(4096, 1, 1);
  fluxSilentGain = fluxAudioContext.createGain();
  fluxSilentGain.gain.value = 0;
  fluxProcessor.onaudioprocess = event => {
    if (!fluxUsingLiveMode || fluxSocket?.readyState !== WebSocket.OPEN) return;
    const samples = event.inputBuffer.getChannelData(0);
    fluxSocket.send(resampleToPcm16(samples, fluxAudioContext.sampleRate));
  };
  fluxSource.connect(fluxProcessor);
  fluxProcessor.connect(fluxSilentGain);
  fluxSilentGain.connect(fluxAudioContext.destination);

  autoConversation = true;
  fluxUsingLiveMode = true;
  autoTurnBusy = false;
  autoSpeechStarting = false;
  autoTranscriptBuffer = "";
  resetAutoUtteranceText();
  setAutoControls(true);
  userInput.value = "";
  updateSpeechMetrics("");
  setStatus("Listening", "ready");
  setLog("Flux live conversation connected. Speak naturally; you can interrupt the avatar.");
}

function updateAutoNoiseFloor(rms) {
  if (!Number.isFinite(rms) || rms <= 0) return;

  const now = performance.now();
  const learning = now - autoNoiseLearningStartedAt < salesSettings.autoNoiseFloorLearningMs;
  const maxNoiseSample = Math.max(salesSettings.autoRecorderRmsThreshold * 1.4, 0.012);

  if (!autoNoiseSamples || (learning && rms < maxNoiseSample)) {
    autoNoiseSamples += 1;
    autoNoiseFloorRms += (rms - autoNoiseFloorRms) / autoNoiseSamples;
    return;
  }

  if (rms < Math.max(autoNoiseFloorRms * 1.35, maxNoiseSample)) {
    autoNoiseFloorRms = autoNoiseFloorRms * 0.96 + rms * 0.04;
  }
}

function currentAutoSpeechThreshold() {
  const fixedThreshold = salesSettings.autoRecorderRmsThreshold;
  if (!adaptiveSpeechGateEnabled() || !autoNoiseFloorRms) return fixedThreshold;
  return Math.max(fixedThreshold, autoNoiseFloorRms * salesSettings.autoSpeechRmsMultiplier);
}

function detectAutoVoiceActivity(rms) {
  if (!adaptiveSpeechGateEnabled()) {
    const active = rms > salesSettings.autoRecorderRmsThreshold;
    if (active) autoLastVoiceEnergyAt = Date.now();
    return active;
  }

  const threshold = currentAutoSpeechThreshold();
  const rawVoiceActive = rms > threshold;

  if (rawVoiceActive) {
    autoSpeechActiveFrames += 1;
    autoSpeechSilentFrames = 0;
  } else {
    autoSpeechSilentFrames += 1;
    autoSpeechActiveFrames = Math.max(0, autoSpeechActiveFrames - 1);
    if (!autoSpeechStarted) updateAutoNoiseFloor(rms);
  }

  const speechStarted = autoSpeechActiveFrames >= salesSettings.autoSpeechStartFrames;
  const speechStillActive = autoSpeechStarted && autoSpeechSilentFrames < salesSettings.autoSpeechEndFrames;
  const voiceActive = speechStarted || speechStillActive;
  if (voiceActive) autoLastVoiceEnergyAt = Date.now();
  return voiceActive;
}

function recentHumanVoiceEnergy() {
  if (!autoAnalyser || !chromeEnergyGateEnabled()) return true;
  const rms = readAnalyserRms();
  const voiceActive = detectAutoVoiceActivity(rms);
  return voiceActive || Date.now() - autoLastVoiceEnergyAt < salesSettings.autoChromeEnergyGraceMs;
}

function clampPercent(value) {
  return Math.round(clamp(Number(value) || 0, 0, 100));
}

function ensureCoachingCanvas() {
  if (coachingCanvas && coachingContext) return true;
  coachingCanvas = document.createElement("canvas");
  coachingCanvas.width = 96;
  coachingCanvas.height = 72;
  coachingContext = coachingCanvas.getContext("2d", { willReadFrequently: true });
  return Boolean(coachingContext);
}

function analyzeSpeechText(text, startedAt = Date.now(), now = Date.now()) {
  const cleanText = compactTranscript(text);
  const words = cleanText.toLowerCase().match(/[a-z']+/g) || [];
  const fillerMatches = cleanText.toLowerCase().match(/\b(um+|uh+|er+|ah+|like|basically|actually|literally|you know|kind of|sort of)\b/g) || [];
  const repeatedWordMatches = cleanText.toLowerCase().match(/\b([a-z']+)\s+\1\b/g) || [];
  const brokenWordMatches = cleanText.toLowerCase().match(/\b[a-z]{1,3}-[a-z]{1,}\b/g) || [];
  const elapsedMinutes = Math.max((now - startedAt) / 60000, 0.08);
  const wpm = words.length / elapsedMinutes;
  const fillerRate = words.length ? fillerMatches.length / words.length : 0;
  const stutterRate = words.length ? (repeatedWordMatches.length + brokenWordMatches.length) / words.length : 0;
  const paceNervousness = wpm < 80 ? (80 - wpm) * 0.6 : wpm > 175 ? (wpm - 175) * 0.8 : 0;
  const stutterNervousness = fillerRate * 260 + stutterRate * 360;

  return {
    text: cleanText,
    words: words.length,
    wpm,
    fillerRate,
    stutterRate,
    paceNervousness: clampPercent(paceNervousness),
    stutterNervousness: clampPercent(stutterNervousness),
  };
}

function cumulativeSpeechText() {
  return compactTranscript([coachingSession.transcript, speechMetrics.text].filter(Boolean).join(" "));
}

function updateSpeechMetrics(text) {
  const cleanText = compactTranscript(text);
  const now = Date.now();
  if (!cleanText) {
    speechMetrics = {
      ...speechMetrics,
      text: "",
      words: 0,
      wpm: 0,
      fillerRate: 0,
      stutterRate: 0,
      paceNervousness: 0,
      stutterNervousness: 0,
    };
    updateNervousnessPanel();
    return;
  }

  if (!speechMetrics.text || cleanText.length < speechMetrics.text.length || !cleanText.startsWith(speechMetrics.text.slice(0, 24))) {
    speechMetrics.startedAt = now;
  }

  const analysis = analyzeSpeechText(cleanText, speechMetrics.startedAt || now, now);
  speechMetrics = {
    ...analysis,
    startedAt: speechMetrics.startedAt || now,
    updatedAt: now,
  };
  updateNervousnessPanel();
}

function recordCompletedSpeechTurn(text) {
  const cleanText = compactTranscript(text);
  if (!cleanText || cleanText === coachingSession.lastRecordedTurn) return;
  coachingSession.transcript = compactTranscript(`${coachingSession.transcript} ${cleanText}`);
  coachingSession.lastRecordedTurn = cleanText;
  speechMetrics.text = "";
  updateNervousnessPanel();
}

function resetCoachingSession() {
  coachingSession = {
    transcript: "",
    lastRecordedTurn: "",
    visualSamples: 0,
    eyeContactTotal: 0,
    movementTotal: 0,
    movementNervousnessTotal: 0,
    gazeNervousnessTotal: 0,
  };
  updateSpeechMetrics("");
}

function scoreColor(score) {
  if (score >= 70) return "var(--bad)";
  if (score >= 40) return "var(--warn)";
  return "var(--accent)";
}

function nervousnessCueText(score) {
  if (activePersonality !== "sales") return "Sales coaching paused";
  if (!repStream) return "Camera off";
  if (score >= 70) return "Slow down, pause, and hold eye contact.";
  if (score >= 40) return "Steady pace. Reduce filler words.";
  return "Calm delivery.";
}

function confidenceCueText(confidence, nervousness) {
  if (activePersonality !== "sales") return "Sales coaching paused";
  if (!repStream) return "Camera off";
  if (confidence >= 75) return "Confident delivery.";
  if (confidence >= 50) return nervousness >= 50 ? "Good base. Slow down and steady your gaze." : "Building confidence.";
  return "Use a slower pace, fewer fillers, and more eye contact.";
}

function updateNervousnessPanel() {
  const visualReady = coachingSession.visualSamples > 0;
  const speechAnalysis = analyzeSpeechText(cumulativeSpeechText(), speechMetrics.startedAt || Date.now());
  const speechReady = speechAnalysis.words > 0;
  const avgEyeContact = visualReady ? coachingSession.eyeContactTotal / coachingSession.visualSamples : 0;
  const avgMovement = visualReady ? coachingSession.movementTotal / coachingSession.visualSamples : 0;
  const eyeNervousness = visualReady ? coachingSession.gazeNervousnessTotal / coachingSession.visualSamples : 0;
  const movementNervousness = visualReady ? coachingSession.movementNervousnessTotal / coachingSession.visualSamples : 0;
  const paceNervousness = speechReady ? speechAnalysis.paceNervousness : 0;
  const stutterNervousness = speechReady ? speechAnalysis.stutterNervousness : 0;
  const score = clampPercent(
    eyeNervousness * 0.25 +
      movementNervousness * 0.25 +
      paceNervousness * 0.2 +
      stutterNervousness * 0.3
  );
  const paceConfidence = speechReady ? clamp(100 - Math.abs(speechAnalysis.wpm - 135) * 1.15, 0, 100) : 0;
  const speechConfidence = speechReady ? clamp(100 - stutterNervousness, 0, 100) : 0;
  const movementConfidence = visualReady ? clamp(100 - movementNervousness, 0, 100) : 0;
  const eyeConfidence = visualReady ? avgEyeContact : 0;
  const confidence = clampPercent(
    eyeConfidence * 0.34 +
      movementConfidence * 0.22 +
      paceConfidence * 0.2 +
      speechConfidence * 0.24
  );

  if (nervousnessScoreOutput) nervousnessScoreOutput.value = String(score);
  if (nervousnessMeter) {
    nervousnessMeter.style.width = `${score}%`;
    nervousnessMeter.style.backgroundColor = scoreColor(score);
  }
  if (confidenceScoreOutput) confidenceScoreOutput.value = String(confidence);
  if (confidenceMeter) {
    confidenceMeter.style.width = `${confidence}%`;
    confidenceMeter.style.backgroundColor = confidence >= 70 ? "var(--ready)" : confidence >= 45 ? "var(--warn)" : "var(--bad)";
  }
  if (eyeContactScoreOutput) eyeContactScoreOutput.value = visualReady ? `${clampPercent(avgEyeContact)}% avg` : "--";
  if (movementScoreOutput) movementScoreOutput.value = visualReady ? `${clampPercent(avgMovement)}/100 avg` : "--";
  if (paceScoreOutput) paceScoreOutput.value = speechReady ? `${Math.round(speechAnalysis.wpm)} wpm avg` : "--";
  if (stutterScoreOutput) {
    const stutterLabel = speechReady ? `${Math.round((speechAnalysis.fillerRate + speechAnalysis.stutterRate) * 100)}% avg` : "--";
    stutterScoreOutput.value = stutterLabel;
  }
  if (nervousnessCue) nervousnessCue.value = `${nervousnessCueText(score)} ${confidenceCueText(confidence, score)}`;
}

async function detectFaceCenter() {
  if (!("FaceDetector" in window) || faceDetectorBusy || !repVideo.videoWidth) return null;
  try {
    if (!faceDetector) faceDetector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
    faceDetectorBusy = true;
    const faces = await faceDetector.detect(repVideo);
    const box = faces?.[0]?.boundingBox;
    if (!box) return null;
    return {
      x: (box.x + box.width / 2) / repVideo.videoWidth,
      y: (box.y + box.height / 2) / repVideo.videoHeight,
    };
  } catch {
    faceDetector = null;
    return null;
  } finally {
    faceDetectorBusy = false;
  }
}

async function sampleCoachingFrame() {
  if (!repStream || repVideo.readyState < 2 || !ensureCoachingCanvas()) {
    coachingFrameId = requestAnimationFrame(sampleCoachingFrame);
    return;
  }

  coachingContext.drawImage(repVideo, 0, 0, coachingCanvas.width, coachingCanvas.height);
  const frame = coachingContext.getImageData(0, 0, coachingCanvas.width, coachingCanvas.height).data;
  let diff = 0;
  let activeX = 0;
  let activeY = 0;
  let activeWeight = 0;

  if (lastVideoSample) {
    for (let index = 0; index < frame.length; index += 16) {
      const pixel = index / 4;
      const x = pixel % coachingCanvas.width;
      const y = Math.floor(pixel / coachingCanvas.width);
      const delta = Math.abs(frame[index] - lastVideoSample[index]) +
        Math.abs(frame[index + 1] - lastVideoSample[index + 1]) +
        Math.abs(frame[index + 2] - lastVideoSample[index + 2]);
      diff += delta;
      if (delta > 36) {
        activeX += x * delta;
        activeY += y * delta;
        activeWeight += delta;
      }
    }
  }

  lastVideoSample = new Uint8ClampedArray(frame);
  const motion = clamp(diff / 18000, 0, 100);
  const faceCenter = await detectFaceCenter();
  const estimatedCenter = activeWeight
    ? { x: activeX / activeWeight / coachingCanvas.width, y: activeY / activeWeight / coachingCanvas.height }
    : { x: 0.5, y: 0.5 };
  const center = faceCenter || estimatedCenter;
  const offCenter = Math.hypot(center.x - 0.5, center.y - 0.44);
  const eyeContact = clamp(100 - offCenter * 210, 0, 100);
  const movement = visualMetrics.movement * 0.84 + motion * 0.16;

  visualMetrics = {
    eyeContact: visualMetrics.eyeContact ? visualMetrics.eyeContact * 0.86 + eyeContact * 0.14 : eyeContact,
    movement,
    movementNervousness: clampPercent(Math.max(0, movement - 10) * 2.3),
    gazeNervousness: clampPercent(100 - eyeContact),
    frameCount: visualMetrics.frameCount + 1,
    faceDetected: Boolean(faceCenter),
  };
  coachingSession.visualSamples += 1;
  coachingSession.eyeContactTotal += visualMetrics.eyeContact;
  coachingSession.movementTotal += visualMetrics.movement;
  coachingSession.movementNervousnessTotal += visualMetrics.movementNervousness;
  coachingSession.gazeNervousnessTotal += visualMetrics.gazeNervousness;
  updateNervousnessPanel();
  coachingFrameId = requestAnimationFrame(sampleCoachingFrame);
}

function currentAutoTranscript() {
  return compactTranscript([autoTranscriptBuffer, autoFinalTranscript, autoInterimTranscript]
    .filter(Boolean)
    .join(" "));
}

function hasTrailingContinuationCue(text) {
  return /\b(and|but|or|so|because|if|when|while|with|for|to|then|also|like)$/i.test(String(text || "").trim());
}

function localTurnDecision(transcript, { finalSegment = false } = {}) {
  const text = compactTranscript(transcript);
  if (text.length < AUTO_MIN_TRANSCRIPT_CHARS) return null;

  if (/[?.!]$/.test(text)) {
    return {
      doneProbability: 0.85,
      doneProbabilityThreshold: salesSettings.doneProbability,
      shouldRespond: 0.85 > salesSettings.doneProbability,
      provider: "local-heuristic",
      model: "punctuation cue",
    };
  }

  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (finalSegment && wordCount >= 1 && !hasTrailingContinuationCue(text)) {
    return {
      doneProbability: 0.96,
      doneProbabilityThreshold: salesSettings.doneProbability,
      shouldRespond: true,
      provider: "local-heuristic",
      model: "auto pause",
    };
  }

  const startsLikeGreeting = /^(hi|hello|hey|good morning|good afternoon|good evening)\b/i.test(text);
  if (finalSegment && startsLikeGreeting) {
    return {
      doneProbability: 0.92,
      doneProbabilityThreshold: salesSettings.doneProbability,
      shouldRespond: true,
      provider: "local-heuristic",
      model: "greeting pause",
    };
  }

  const startsLikeQuestion = /^(who|what|when|where|why|how|can|could|would|will|do|does|did|is|are|should)\b/i.test(text);
  const pausedCompleteTurn = finalSegment &&
    (wordCount >= salesSettings.autoLocalPauseMinWords || (startsLikeQuestion && wordCount >= 3));
  if (pausedCompleteTurn) {
    return {
      doneProbability: 0.9,
      doneProbabilityThreshold: salesSettings.doneProbability,
      shouldRespond: true,
      provider: "local-heuristic",
      model: "final speech segment",
    };
  }

  return null;
}

function resetAutoUtteranceText() {
  autoFinalTranscript = "";
  autoInterimTranscript = "";
  autoLastTranscriptAt = 0;
  autoLastTranscriptText = "";
}

function setAutoControls(active) {
  autoConversationButton.textContent = active ? "Auto On" : "Auto";
  autoConversationButton.classList.toggle("active", active);
  listenButton.disabled = active;
  stopListenButton.disabled = true;
  roleplayButton.disabled = active;
}

function scheduleAutoTurnCheck(delay = salesSettings.autoPauseMs) {
  if (!autoConversation) return;
  if (autoPauseTimer) window.clearTimeout(autoPauseTimer);
  autoPauseTimer = window.setTimeout(() => {
    autoPauseTimer = null;
    requestAutoTurnDecision();
  }, delay);
}

function scheduleAutoForceTurnCheck() {
  if (!autoConversation) return;
  if (autoForceTurnTimer) window.clearTimeout(autoForceTurnTimer);

  autoForceTurnTimer = window.setTimeout(() => {
    autoForceTurnTimer = null;
    const transcript = currentAutoTranscript();
    const stableFor = Date.now() - autoLastTranscriptAt;
    const transcriptIsStable = transcript &&
      transcript === autoLastTranscriptText &&
      stableFor >= salesSettings.autoForceTurnMs - 25;

    if (!autoConversation || !transcriptIsStable) return;

    if (isAvatarEchoGuardActive() || autoTurnBusy) {
      scheduleAutoForceTurnCheck();
      return;
    }

    requestAutoTurnDecision({ forceStableTranscript: true });
  }, salesSettings.autoForceTurnMs);
}

function isAvatarEchoGuardActive() {
  return autoSpeechStarting || (state.speaking && !autoPreListening) || Date.now() < autoIgnoreMicUntil;
}

function autoEchoGuardDelayMs() {
  if (autoSpeechStarting) return 250;
  if (state.speaking && !autoPreListening) return Math.max(120, salesSettings.autoListenBeforeSpeechEndMs);
  return Math.max(0, autoIgnoreMicUntil - Date.now());
}

function holdMicForAvatarSpeech(extraMs = salesSettings.avatarEchoCooldownMs) {
  autoIgnoreMicUntil = Math.max(autoIgnoreMicUntil, Date.now() + extraMs);
}

function scheduleAutoListenBeforeSpeechEnd(durationMs) {
  if (!autoConversation || !Number.isFinite(durationMs) || durationMs <= 0) return;
  if (autoEarlyListenTimer) window.clearTimeout(autoEarlyListenTimer);
  const delay = Math.max(0, durationMs - salesSettings.autoListenBeforeSpeechEndMs);
  autoEarlyListenTimer = window.setTimeout(() => {
    autoEarlyListenTimer = null;
    if (!autoConversation || !state.speaking) return;
    autoPreListening = true;
    autoIgnoreMicUntil = 0;
    resetAutoUtteranceText();
    startAutoRecognitionNow();
    if (autoUsingRecorderMode) startAutoRecorderSegment();
  }, delay);
}

function noteAutoSpeechActivity() {
  if (!autoConversation) return;

  if (isAvatarEchoGuardActive()) {
    return;
  }

  if (!autoTurnBusy) {
    setStatus("Listening", "busy");
  }
}

function readAnalyserRms() {
  if (!autoAnalyser) return 0;

  const samples = new Float32Array(autoAnalyser.fftSize);
  autoAnalyser.getFloatTimeDomainData(samples);
  let sum = 0;
  for (let index = 0; index < samples.length; index += 1) {
    sum += samples[index] * samples[index];
  }
  return Math.sqrt(sum / samples.length);
}

function autoRecorderStreamIsActive() {
  return Boolean(autoRecorderStream?.active && autoRecorderStream.getAudioTracks().some(track => track.readyState === "live"));
}

function monitorAutoRecorder() {
  if (!autoConversation || !autoRecorder || !autoAnalyser) return;

  if (isAvatarEchoGuardActive()) {
    autoRecorderChunks = [];
    autoSpeechStarted = false;
    autoSilenceStartedAt = 0;
    autoRecorderStartedAt = performance.now();
    autoMonitorFrame = requestAnimationFrame(monitorAutoRecorder);
    return;
  }

  const now = performance.now();
  const rms = readAnalyserRms();
  const voiceActive = detectAutoVoiceActivity(rms);

  if (voiceActive) {
    if (!autoSpeechStarted) {
      autoSpeechStarted = true;
      autoRecorderStartedAt = now;
      noteAutoSpeechActivity();
    }
    autoSilenceStartedAt = 0;
  } else if (autoSpeechStarted && !autoSilenceStartedAt) {
    autoSilenceStartedAt = now;
  }

  const speechDuration = now - autoRecorderStartedAt;
  const silenceDuration = autoSilenceStartedAt ? now - autoSilenceStartedAt : 0;
  const shouldCloseSegment = autoSpeechStarted &&
    speechDuration > salesSettings.autoRecorderMinSpeechMs &&
    (silenceDuration > salesSettings.autoRecorderSilenceMs || speechDuration > salesSettings.autoRecorderMaxSegmentMs);

  if (shouldCloseSegment && autoRecorder.state === "recording") {
    autoRecorder.stop();
    return;
  }

  autoMonitorFrame = requestAnimationFrame(monitorAutoRecorder);
}

async function processAutoRecordedSegment(blob) {
  if (!autoConversation || !blob?.size) return;

  if (autoTurnBusy) {
    autoTurnPending = true;
    window.setTimeout(() => processAutoRecordedSegment(blob), 250);
    return;
  }

  autoTurnBusy = true;
  autoTurnPending = false;
  setStatus("Transcribing", "busy");
  setLog("Auto recorder heard a pause. Sending the segment to Cloudflare Whisper.");

  try {
    const transcript = await transcribeBlob(blob);
    if (!autoConversation) return;

    if (!transcript) {
      setStatus("Listening", "ready");
      return;
    }

    const combinedTranscript = compactTranscript([autoTranscriptBuffer, transcript].filter(Boolean).join(" "));
    const quality = transcriptQuality(combinedTranscript);
    if (!quality.meaningful) {
      autoTranscriptBuffer = "";
      resetAutoUtteranceText();
      setStatus("Listening", "ready");
      setLog(`Ignored likely background noise: ${quality.reason}`);
      return;
    }

    userInput.value = combinedTranscript;
    updateSpeechMetrics(combinedTranscript);
    setLog(`transcript: ${combinedTranscript}\nAuto mode is responding after the pause.`);

    const result = await requestCustomerReply({ scenario: combinedTranscript, autoSpeak: true, forceRespond: true });

    if (result?.shouldRespond) {
      autoTranscriptBuffer = "";
      resetAutoUtteranceText();
      return;
    }

    autoTranscriptBuffer = combinedTranscript;
    resetAutoUtteranceText();
    setStatus("Listening", "ready");
  } catch (error) {
    if (autoConversation) {
      setStatus("Auto recorder failed", "bad");
      setLog(`Auto recorder failed: ${error.message || error}`);
    }
  } finally {
    autoTurnBusy = false;
    if (autoConversation) {
      startAutoRecorderSegment();
    }
  }
}

async function startAutoRecorderSegment() {
  if (!autoConversation || !autoUsingRecorderMode) return;
  if (!autoRecorderStreamIsActive()) {
    try {
      await setupAutoRecorderResources();
    } catch (error) {
      if (autoConversation) {
        setStatus("Auto unavailable", "bad");
        setLog(`Auto recorder unavailable: ${error.message || error}`);
        stopAutoConversation();
      }
      return;
    }
  }

  if (!autoRecorder || autoRecorder.state !== "inactive") return;
  if (isAvatarEchoGuardActive()) {
    window.setTimeout(startAutoRecorderSegment, autoEchoGuardDelayMs() + 120);
    return;
  }

  autoRecorderChunks = [];
  autoSpeechStarted = false;
  autoSilenceStartedAt = 0;
  autoRecorderStartedAt = performance.now();
  autoSpeechActiveFrames = 0;
  autoSpeechSilentFrames = 0;
  try {
    autoRecorder.start(250);
    setStatus("Listening", "ready");
    autoMonitorFrame = requestAnimationFrame(monitorAutoRecorder);
  } catch (error) {
    setLog(`Auto recorder restart failed: ${error.message || error}`);
    stopAutoRecorderResources();
    if (autoConversation) window.setTimeout(startAutoRecorderSegment, 250);
  }
}

function ensureAutoRecognition() {
  const Recognition = speechRecognitionFactory();
  if (!Recognition) {
    return null;
  }

  if (autoRecognition) return autoRecognition;

  autoRecognition = new Recognition();
  autoRecognition.lang = salesSettings.language || "en-US";
  autoRecognition.interimResults = true;
  autoRecognition.continuous = true;
  autoRecognition.maxAlternatives = 1;

  autoRecognition.onstart = () => {
    listening = true;
    if (isAvatarEchoGuardActive()) {
      try {
        autoRecognition.stop();
      } catch {
        // Recognition may already be stopped.
      }
      return;
    }
    setStatus("Listening", "ready");
    setLog("Listening now.");
  };

  autoRecognition.onresult = (event) => {
    if (!autoConversation) return;

    if (isAvatarEchoGuardActive()) {
      autoInterimTranscript = "";
      return;
    }

    const hasRecentVoiceEnergy = recentHumanVoiceEnergy();

    let interim = "";
    let heardSpeech = false;

    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const transcript = event.results[index][0]?.transcript || "";
      if (!transcript.trim()) continue;
      const confidence = Number(event.results[index][0]?.confidence || 1);
      const quality = transcriptQuality(transcript, confidence);
      if (!hasRecentVoiceEnergy && !event.results[index].isFinal) continue;
      if (!quality.meaningful && !event.results[index].isFinal) continue;
      heardSpeech = true;
      if (event.results[index].isFinal) {
        if (!hasRecentVoiceEnergy) {
          setLog("Ignored speech recognition text without matching mic voice energy.");
          continue;
        }
        if (!quality.meaningful) {
          setLog(`Ignored likely noise: ${quality.reason}`);
          continue;
        }
        autoFinalTranscript = compactTranscript(`${autoFinalTranscript} ${transcript}`);
        interim = "";
      } else {
        interim = compactTranscript(`${interim} ${transcript}`);
      }
    }

    autoInterimTranscript = interim;
    const transcript = currentAutoTranscript();
    if (transcript) {
      if (transcript !== autoLastTranscriptText) {
        autoLastTranscriptText = transcript;
        autoLastTranscriptAt = Date.now();
      }
      userInput.value = transcript;
      updateSpeechMetrics(transcript);
    }

    if (heardSpeech) {
      noteAutoSpeechActivity();
      scheduleAutoTurnCheck();
      if (transcript) scheduleAutoForceTurnCheck();
    }
  };

  autoRecognition.onerror = (event) => {
    if (!autoConversation) return;

    const recoverable = ["aborted", "no-speech", "network"].includes(event.error);
    setLog(`Auto speech recognition: ${event.error || "stopped"}`);
    if (!recoverable) {
      stopAutoConversation();
      setStatus("Auto unavailable", "bad");
    }
  };

  autoRecognition.onend = () => {
    listening = false;
    if (!autoConversation) return;
    autoRestartTimer = window.setTimeout(() => {
      autoRestartTimer = null;
      startAutoRecognitionNow();
    }, isAvatarEchoGuardActive() ? autoEchoGuardDelayMs() + 120 : 160);
  };

  return autoRecognition;
}

function startAutoRecognitionNow(delay = 0) {
  if (!autoConversation || !autoRecognition) return;
  window.setTimeout(() => {
    if (!autoConversation || !autoRecognition || listening) return;
    if (isAvatarEchoGuardActive()) {
      startAutoRecognitionNow(autoEchoGuardDelayMs() + 120);
      return;
    }
    try {
      autoRecognition.start();
    } catch {
      scheduleAutoTurnCheck(250);
    }
  }, delay);
}

async function requestAutoTurnDecision({ forceStableTranscript = false } = {}) {
  if (!autoConversation) return;

  if (isAvatarEchoGuardActive()) {
    autoTurnPending = true;
    scheduleAutoTurnCheck(autoEchoGuardDelayMs() + 80);
    return;
  }

  const transcript = currentAutoTranscript();
  if (transcript.length < AUTO_MIN_TRANSCRIPT_CHARS) {
    if (!state.speaking) setStatus("Listening", "ready");
    if (transcript) scheduleAutoTurnCheck(200);
    return;
  }
  const quality = transcriptQuality(transcript);
  if (!quality.meaningful) {
    autoTranscriptBuffer = "";
    resetAutoUtteranceText();
    setStatus("Listening", "ready");
    setLog(`Ignored likely background noise: ${quality.reason}`);
    return;
  }

  if (autoTurnBusy) {
    autoTurnPending = true;
    return;
  }

  if (autoPauseTimer) {
    window.clearTimeout(autoPauseTimer);
    autoPauseTimer = null;
  }
  if (autoForceTurnTimer) {
    window.clearTimeout(autoForceTurnTimer);
    autoForceTurnTimer = null;
  }

  autoTurnBusy = true;
  autoTurnPending = false;
  setStatus("Thinking", "busy");
  setLog(`live transcript: ${transcript}\nAuto mode is responding after the pause.`);

  try {
    if (!autoConversation) return;

    const result = await requestCustomerReply({ scenario: transcript, autoSpeak: true, forceRespond: true });
    if (result?.shouldRespond) {
      autoTranscriptBuffer = "";
      resetAutoUtteranceText();
      return;
    }

    autoTranscriptBuffer = transcript;
    resetAutoUtteranceText();
    setStatus("Listening", "ready");
  } catch (error) {
    if (autoConversation) {
      setStatus("Auto conversation failed", "bad");
      setLog(`Auto conversation failed: ${error.message || error}`);
    }
  } finally {
    autoTurnBusy = false;
    if (autoConversation && autoTurnPending) {
      autoTurnPending = false;
      scheduleAutoTurnCheck(120);
    } else if (autoConversation && !autoSpeechStarting && !state.speaking && statusDot.dataset.tone !== "bad") {
      setStatus("Listening", "ready");
    }
  }
}

async function requestFastTurnDecision(transcript) {
  const response = await authFetch("/api/ai-sales/turn", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      scenario: transcript,
      conversation: conversationTurns,
      language: salesSettings.language,
      model: salesSettings.deepseekTurnModel || salesSettings.deepseekModel,
      doneProbabilityThreshold: salesSettings.doneProbability,
    }),
  });
  const payload = await readJsonResponse(response);

  if (!response.ok) {
    if (response.status === 404) {
      return {
        doneProbability: 1,
        doneProbabilityThreshold: salesSettings.doneProbability,
        shouldRespond: true,
        provider: "coach-fallback",
        model: "turn route unavailable",
      };
    }
    throw new Error(payload.error || `Turn detection failed (${response.status})`);
  }

  const doneProbability = Number(payload.doneProbability ?? 0);
  const doneProbabilityThreshold = clampProbability(payload.doneProbabilityThreshold, salesSettings.doneProbability);
  return {
    ...payload,
    doneProbability,
    doneProbabilityThreshold,
    shouldRespond: payload.shouldRespond !== false && doneProbability > doneProbabilityThreshold,
  };
}

async function startAutoConversation() {
  if (autoConversation) return;

  if (fluxEnabled()) {
    try {
      setStatus("Connecting Flux", "busy");
      await startFluxConversation();
      return;
    } catch (error) {
      stopFluxResources();
      setLog(`Flux unavailable; using browser fallback: ${error.message || error}`);
    }
  }

  if (preferRecorderModeEnabled()) {
    await startAutoRecorderConversation();
    return;
  }

  const activeRecognition = ensureAutoRecognition();
  if (!activeRecognition) {
    await startAutoRecorderConversation();
    return;
  }

  try {
    await ensureRepCamera();
    if (chromeEnergyGateEnabled()) {
      await setupAutoRecorderResources();
    }
    autoConversation = true;
    autoUsingRecorderMode = false;
    autoTurnBusy = false;
    autoTurnPending = false;
    autoSpeechStarting = false;
    autoPreListening = false;
    autoTranscriptBuffer = "";
    resetAutoUtteranceText();
    setAutoControls(true);
    userInput.value = "";
    updateSpeechMetrics("");
    setStatus("Starting mic", "busy");
    setLog("Starting live speech recognition. Begin speaking after it says Listening.");
    startAutoRecognitionNow();
  } catch (error) {
    autoConversation = false;
    autoUsingRecorderMode = false;
    stopAutoRecorderResources();
    setAutoControls(false);
    setStatus("Auto unavailable", "bad");
    setLog(`Auto conversation unavailable: ${error.message || error}`);
  }
}

async function setupAutoRecorderResources() {
  stopAutoRecorderResources();
  autoRecorderStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error("AudioContext is unavailable.");
  }

  autoAudioContext = new AudioContextClass();
  const source = autoAudioContext.createMediaStreamSource(autoRecorderStream);
  autoAnalyser = autoAudioContext.createAnalyser();
  autoAnalyser.fftSize = 1024;
  autoAnalyser.smoothingTimeConstant = 0.08;
  source.connect(autoAnalyser);
  resetAutoSpeechGate();

  autoRecorder = new MediaRecorder(autoRecorderStream);
  autoRecorder.ondataavailable = (event) => {
    if (event.data?.size) autoRecorderChunks.push(event.data);
  };
  autoRecorder.onstop = () => {
    if (autoMonitorFrame) {
      cancelAnimationFrame(autoMonitorFrame);
      autoMonitorFrame = null;
    }

    const chunks = autoRecorderChunks;
    const mimeType = autoRecorder.mimeType || "audio/webm";
    autoRecorderChunks = [];
    autoSpeechStarted = false;
    autoSilenceStartedAt = 0;

    if (!autoConversation || !chunks.length) return;
    processAutoRecordedSegment(new Blob(chunks, { type: mimeType }));
  };
}

async function startAutoRecorderConversation() {
  if (autoConversation) return;

  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    setStatus("Auto speech unavailable", "warn");
    setLog("This browser cannot expose live SpeechRecognition or MediaRecorder microphone capture.");
    return;
  }

  try {
    setStatus("Starting recorder auto", "busy");
    await ensureRepCamera();
    await setupAutoRecorderResources();

    autoConversation = true;
    autoUsingRecorderMode = true;
    autoTurnBusy = false;
    autoTurnPending = false;
    autoSpeechStarting = false;
    autoPreListening = false;
    autoTranscriptBuffer = "";
    resetAutoUtteranceText();
    setAutoControls(true);
    userInput.value = "";
    updateSpeechMetrics("");
    startAutoRecorderSegment();
    setLog("Auto conversation is using microphone recording plus Cloudflare Whisper because live SpeechRecognition is unavailable.");
  } catch (error) {
    autoConversation = false;
    autoUsingRecorderMode = false;
    stopAutoRecorderResources();
    setAutoControls(false);
    setStatus("Auto unavailable", "bad");
    setLog(`Auto recorder unavailable: ${error.message || error}`);
  }
}

function stopAutoConversation() {
  if (!autoConversation && !autoRecognition && !autoRecorder && !fluxSocket) return;

  autoConversation = false;
  autoUsingRecorderMode = false;
  autoTurnBusy = false;
  autoTurnPending = false;
  autoSpeechStarting = false;
  autoPreListening = false;
  autoTranscriptBuffer = "";
  resetAutoUtteranceText();
  clearAutoTimers();
  stopFluxResources();

  try {
    autoRecognition?.stop?.();
  } catch {
    // Recognition may already be stopped.
  }
  stopAutoRecorderResources();

  setAutoControls(false);
  setStatus("Avatar ready", "ready");
  setLog("Auto conversation stopped.");
}

function toggleAutoConversation() {
  if (autoConversation) {
    stopAutoConversation();
    return;
  }
  startAutoConversation();
}

function startListening() {
  if (autoConversation) return;

  const activeRecognition = ensureRecognition();
  if (!activeRecognition) {
    startAudioRecordingFallback();
    return;
  }
  if (listening) return;
  userInput.value = "";
  updateSpeechMetrics("");
  setStatus("Starting mic", "busy");
  setLog("Starting speech recognition. Begin speaking after it says Listening.");
  activeRecognition.start();
}

function stopListening() {
  if (recording && mediaRecorder) {
    mediaRecorder.stop();
    return;
  }

  if (recognition && listening) {
    recognition.stop();
  }
}

function rememberTurn(role, text) {
  if (!text) return;
  conversationTurns.push({ role, text });
  while (conversationTurns.length > salesSettings.conversationTurns * 2) conversationTurns.shift();
}

function isEnabledSetting(value) {
  return String(value).toLowerCase() !== "false";
}

async function localKidsReply(input) {
  if (activePersonality !== "kids") return null;

  const text = compactTranscript(input).toLowerCase();
  if (!text) return null;

  if (pendingKidsActivity) {
    const activity = pendingKidsActivity;
    const childAnswer = parseChildNumber(text);
    const correctAnswer = Number(activity.answer);
    const answeredCorrectly = Number.isFinite(childAnswer) && childAnswer === correctAnswer;

    showKidsActivity(activity, true);
    setStatus("Showing answer", "ready");
    await wait(1700);
    hideKidsActivity();
    kidsMathGameOffered = true;

    return {
      text: answeredCorrectly
        ? `Yes, that's right. The true answer is ${correctAnswer}. ${activity.reveal}. Do you want another one?`
        : `Good try. The true answer is ${correctAnswer}. ${activity.reveal}. Do you want another one?`,
      provider: "local-kids-math",
      model: "local-calculator",
      shouldRespond: true,
    };
  }

  if (childSaidYes(text)) {
    return startKidsMathQuestion();
  }

  if (childSaidNo(text)) {
    return startKidsAbcLesson();
  }

  if (childMentionedMath(text) || /\b(hi|hello|hey)\b/.test(text)) {
    kidsMathGameActive = false;
    kidsMathGameOffered = true;
    hideKidsActivity();
    return {
      text: "Do you want to play a math game with me?",
      provider: "local-kids-math",
      model: "local-calculator",
      shouldRespond: true,
    };
  }

  if (!isEnabledSetting(salesSettings.kidsModeFastLocalReplies)) return null;

  if (/\b(name|called)\b/.test(text)) {
    return "My name is John. What is your name?";
  }
  if (/\b(apple|ball|car|truck|dinosaur|train|star|book)\b/.test(text)) {
    return "Nice word. Can you say it one more time slowly?";
  }
  if (/\b(count|number|one|two|three|four|five)\b/.test(text)) {
    return "Let's count together. One, two, three. What comes next?";
  }
  if (/\b(six|seven|eight|nine|ten)\b/.test(text)) {
    return "Great counting. Let's clap and count again. One, two, three.";
  }
  if (/\b(letter|alphabet|abc|a b c)\b/.test(text)) {
    return startKidsAbcLesson();
  }
  if (/^[a-z]$/.test(text) || /\b(a|b|c|d|e|f|g)\b/.test(text)) {
    return "Good letter. A says ah. Can you say ah?";
  }
  if (/\b(color|red|blue|green|yellow)\b/.test(text)) {
    return "Colors are fun. Can you find something blue?";
  }
  if (/\b(purple|pink|orange|black|white|brown)\b/.test(text)) {
    return "That's a great color. Can you find that color near you?";
  }
  if (/\b(animal|dog|cat|cow|duck)\b/.test(text)) {
    return "Animals are fun. What sound does a cow make?";
  }
  if (/\b(bird|fish|horse|pig|sheep|lion|tiger|bear)\b/.test(text)) {
    return "Good animal. What sound does that animal make?";
  }
  if (/\b(mom|mommy|dad|daddy|baby|sister|brother)\b/.test(text)) {
    return "That's nice. Can you tell me one word about them?";
  }
  if (text.split(/\s+/).length <= 4) {
    return "That was great. Do you want to count or say letters?";
  }

  return null;
}

window.addEventListener("error", (event) => {
  setStatus("Runtime error", "bad");
  setLog(`Runtime error: ${event.message || "unknown error"}`);
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason?.message || event.reason || "unknown promise rejection";
  setStatus("Runtime error", "bad");
  setLog(`Runtime error: ${reason}`);
});

canvas.addEventListener("webglcontextlost", (event) => {
  event.preventDefault();
  setStatus("WebGL context lost", "bad");
  rendererStatus.value = "webgl lost";
  modelStatus.value = "fallback retained";
  if (fallbackAvatarRoot) fallbackAvatarRoot.visible = true;
  setLog("WebGL context was lost while rendering the model. The fallback avatar is retained so the canvas does not go blank.");
});

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function numericControl(element, fallback) {
  const value = Number(element?.value);
  return Number.isFinite(value) ? value : fallback;
}

function setCameraBase(target, distance) {
  if (!THREE || !camera) return;
  cameraBase = {
    target: target.clone(),
    distance,
  };
  applyCameraControls();
}

function applyCameraControls() {
  if (!THREE || !camera || !cameraBase) return;

  const offsetX = numericControl(cameraXInput, 0);
  const offsetY = numericControl(cameraYInput, 0);
  const distanceScale = numericControl(cameraDistanceInput, 1);
  const angle = (numericControl(cameraAngleInput, 0) * Math.PI) / 180;
  const distance = cameraBase.distance * distanceScale;
  const target = cameraBase.target.clone();

  target.x += offsetX;
  target.y += offsetY;

  camera.position.set(
    target.x + Math.sin(angle) * distance,
    target.y,
    target.z + Math.cos(angle) * distance,
  );
  camera.lookAt(target);
  camera.updateProjectionMatrix();
}

function resetCameraControls() {
  if (cameraXInput) cameraXInput.value = "0";
  if (cameraYInput) cameraYInput.value = "0";
  if (cameraDistanceInput) cameraDistanceInput.value = "1";
  if (cameraAngleInput) cameraAngleInput.value = "0";
  applyCameraControls();
}

function smoothstep(edge0, edge1, value) {
  const x = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return x * x * (3 - 2 * x);
}

function createSkinTexture() {
  const textureCanvas = document.createElement("canvas");
  textureCanvas.width = 256;
  textureCanvas.height = 256;
  const textureContext = textureCanvas.getContext("2d");
  const gradient = textureContext.createLinearGradient(0, 0, 256, 256);
  gradient.addColorStop(0, "#f1c7ac");
  gradient.addColorStop(0.54, "#d99d80");
  gradient.addColorStop(1, "#bd7c65");
  textureContext.fillStyle = gradient;
  textureContext.fillRect(0, 0, 256, 256);

  const image = textureContext.getImageData(0, 0, 256, 256);
  for (let i = 0; i < image.data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 12;
    image.data[i] = clamp(image.data[i] + noise, 0, 255);
    image.data[i + 1] = clamp(image.data[i + 1] + noise * 0.75, 0, 255);
    image.data[i + 2] = clamp(image.data[i + 2] + noise * 0.55, 0, 255);
  }
  textureContext.putImageData(image, 0, 0);

  textureContext.fillStyle = "rgba(255, 228, 214, 0.15)";
  for (let i = 0; i < 220; i += 1) {
    textureContext.beginPath();
    textureContext.arc(Math.random() * 256, Math.random() * 256, Math.random() * 1.2 + 0.2, 0, Math.PI * 2);
    textureContext.fill();
  }

  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function materialSet() {
  const skinTexture = createSkinTexture();
  const skin = new THREE.MeshPhysicalMaterial({
    map: skinTexture,
    roughness: 0.68,
    metalness: 0,
    sheen: 0.24,
    clearcoat: 0.03,
    clearcoatRoughness: 0.8,
  });

  return {
    skin,
    skinSoft: new THREE.MeshPhysicalMaterial({
      color: 0xd8977a,
      roughness: 0.72,
      metalness: 0,
      sheen: 0.16,
    }),
    lip: new THREE.MeshPhysicalMaterial({
      color: 0x9e4754,
      roughness: 0.5,
      metalness: 0,
      clearcoat: 0.12,
      clearcoatRoughness: 0.58,
    }),
    mouth: new THREE.MeshStandardMaterial({ color: 0x241015, roughness: 0.8 }),
    teeth: new THREE.MeshPhysicalMaterial({
      color: 0xf4f0df,
      roughness: 0.38,
      metalness: 0,
      clearcoat: 0.26,
      transparent: true,
      opacity: 0.9,
    }),
    tongue: new THREE.MeshPhysicalMaterial({ color: 0xbe5c6f, roughness: 0.64, transparent: true, opacity: 0.72 }),
    eyeWhite: new THREE.MeshPhysicalMaterial({
      color: 0xf6f7ef,
      roughness: 0.22,
      clearcoat: 0.58,
      clearcoatRoughness: 0.25,
    }),
    iris: new THREE.MeshPhysicalMaterial({ color: 0x506c74, roughness: 0.2, clearcoat: 0.5 }),
    pupil: new THREE.MeshBasicMaterial({ color: 0x11161b }),
    hair: new THREE.MeshPhysicalMaterial({
      color: 0x1f2830,
      roughness: 0.48,
      anisotropy: 0.35,
      clearcoat: 0.08,
    }),
    brow: new THREE.MeshStandardMaterial({ color: 0x202932, roughness: 0.55 }),
    suit: new THREE.MeshPhysicalMaterial({ color: 0x1b2a36, roughness: 0.62, metalness: 0.02 }),
    shirt: new THREE.MeshStandardMaterial({ color: 0xf5f7f3, roughness: 0.55 }),
    tie: new THREE.MeshStandardMaterial({ color: 0x106853, roughness: 0.5 }),
    backdrop: new THREE.MeshStandardMaterial({ color: 0xe4eef0, roughness: 0.95 }),
  };
}

function addMesh(parent, geometry, material, position = [0, 0, 0], scale = [1, 1, 1], rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function createCapsule(radius, length, material) {
  return new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 12, 28), material);
}

function buildAvatar() {
  const materials = materialSet();
  const root = new THREE.Group();
  root.position.set(0, -1.15, 0);
  scene.add(root);
  avatarRoot = root;

  const floor = new THREE.Mesh(new THREE.CircleGeometry(2.2, 96), new THREE.MeshStandardMaterial({ color: 0xbfd2d6, roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -0.92, -0.05);
  floor.receiveShadow = true;
  scene.add(floor);

  addMesh(root, new THREE.CapsuleGeometry(0.8, 0.9, 24, 48), materials.suit, [0, -0.1, -0.08], [1.05, 0.74, 0.42]);
  addMesh(root, new THREE.CapsuleGeometry(0.34, 0.56, 16, 32), materials.shirt, [0, -0.06, 0.22], [0.72, 0.78, 0.28]);
  addMesh(root, new THREE.ConeGeometry(0.18, 0.72, 4), materials.tie, [0, -0.25, 0.48], [0.64, 1, 0.16], [0, 0, Math.PI / 4]);
  addMesh(root, new THREE.CapsuleGeometry(0.19, 0.42, 18, 32), materials.skin, [0, 0.53, 0], [0.78, 1, 0.68]);

  headGroup = new THREE.Group();
  headGroup.position.set(0, 1.16, 0.08);
  root.add(headGroup);

  rig.head = addMesh(headGroup, new THREE.SphereGeometry(0.72, 72, 72), materials.skin, [0, 0, 0], [0.82, 1.04, 0.74]);
  addMesh(headGroup, new THREE.SphereGeometry(0.13, 32, 24), materials.skinSoft, [-0.61, -0.04, -0.04], [0.48, 0.74, 0.32]);
  addMesh(headGroup, new THREE.SphereGeometry(0.13, 32, 24), materials.skinSoft, [0.61, -0.04, -0.04], [0.48, 0.74, 0.32]);

  const hairCap = addMesh(
    headGroup,
    new THREE.SphereGeometry(0.74, 72, 32, 0, Math.PI * 2, 0, Math.PI * 0.58),
    materials.hair,
    [0, 0.2, -0.05],
    [0.9, 0.74, 0.86],
  );
  hairCap.rotation.x = -0.12;
  addMesh(headGroup, new THREE.SphereGeometry(0.24, 32, 24), materials.hair, [-0.39, 0.2, 0.14], [0.84, 0.58, 0.38]);
  addMesh(headGroup, new THREE.SphereGeometry(0.2, 32, 24), materials.hair, [0.38, 0.21, 0.12], [0.8, 0.52, 0.36]);
  addMesh(headGroup, new THREE.SphereGeometry(0.21, 32, 24), materials.hair, [-0.5, -0.03, -0.02], [0.44, 1.2, 0.42]);
  addMesh(headGroup, new THREE.SphereGeometry(0.21, 32, 24), materials.hair, [0.5, -0.03, -0.02], [0.44, 1.2, 0.42]);

  rig.eyes = [];
  rig.irises = [];
  rig.pupils = [];
  rig.lids = [];
  [-1, 1].forEach((side) => {
    const eye = addMesh(headGroup, new THREE.SphereGeometry(0.105, 32, 20), materials.eyeWhite, [side * 0.27, 0.14, 0.54], [1.15, 0.62, 0.32]);
    const iris = addMesh(headGroup, new THREE.SphereGeometry(0.036, 24, 16), materials.iris, [side * 0.27, 0.14, 0.61], [1, 1, 0.24]);
    const pupil = addMesh(headGroup, new THREE.SphereGeometry(0.016, 16, 12), materials.pupil, [side * 0.27, 0.14, 0.635], [1, 1, 0.16]);
    const upper = createCapsule(0.025, 0.19, materials.skinSoft);
    upper.rotation.z = Math.PI / 2;
    upper.position.set(side * 0.27, 0.22, 0.63);
    upper.scale.set(1.16, 0.75, 0.72);
    headGroup.add(upper);
    const lower = createCapsule(0.02, 0.16, materials.skinSoft);
    lower.rotation.z = Math.PI / 2;
    lower.position.set(side * 0.27, 0.065, 0.622);
    lower.scale.set(1.08, 0.62, 0.7);
    headGroup.add(lower);
    rig.eyes.push(eye);
    rig.irises.push(iris);
    rig.pupils.push(pupil);
    rig.lids.push({ upper, lower, side });
  });

  rig.brows = [-1, 1].map((side) => {
    const brow = createCapsule(0.024, 0.25, materials.brow);
    brow.rotation.z = Math.PI / 2 + side * -0.08;
    brow.position.set(side * 0.27, 0.34, 0.57);
    brow.scale.set(1.1, 1, 0.72);
    headGroup.add(brow);
    return { mesh: brow, side };
  });

  addMesh(headGroup, new THREE.CapsuleGeometry(0.036, 0.22, 10, 24), materials.skinSoft, [0, 0.03, 0.61], [0.9, 1, 0.62], [0.08, 0, 0]);
  addMesh(headGroup, new THREE.SphereGeometry(0.075, 32, 20), materials.skinSoft, [0, -0.07, 0.64], [0.9, 0.72, 0.64]);
  addMesh(headGroup, new THREE.SphereGeometry(0.015, 12, 8), materials.mouth, [-0.04, -0.105, 0.695], [1, 0.55, 0.5]);
  addMesh(headGroup, new THREE.SphereGeometry(0.015, 12, 8), materials.mouth, [0.04, -0.105, 0.695], [1, 0.55, 0.5]);

  rig.cheeks = [
    addMesh(headGroup, new THREE.SphereGeometry(0.13, 32, 16), materials.skinSoft, [-0.31, -0.11, 0.5], [1.2, 0.52, 0.16]),
    addMesh(headGroup, new THREE.SphereGeometry(0.13, 32, 16), materials.skinSoft, [0.31, -0.11, 0.5], [1.2, 0.52, 0.16]),
  ];

  const mouthGroup = new THREE.Group();
  mouthGroup.position.set(0, -0.43, 0.61);
  headGroup.add(mouthGroup);
  rig.mouthGroup = mouthGroup;
  rig.mouthInterior = addMesh(mouthGroup, new THREE.SphereGeometry(0.24, 48, 24), materials.mouth, [0, -0.03, 0], [1.1, 0.15, 0.3]);
  rig.upperLip = createCapsule(0.027, 0.32, materials.lip);
  rig.upperLip.rotation.z = Math.PI / 2;
  rig.upperLip.position.set(0, 0.02, 0.035);
  mouthGroup.add(rig.upperLip);
  rig.lowerLip = createCapsule(0.032, 0.32, materials.lip);
  rig.lowerLip.rotation.z = Math.PI / 2;
  rig.lowerLip.position.set(0, -0.055, 0.04);
  mouthGroup.add(rig.lowerLip);
  rig.leftCorner = addMesh(mouthGroup, new THREE.SphereGeometry(0.035, 18, 12), materials.lip, [-0.24, -0.015, 0.04], [1.18, 0.72, 0.54]);
  rig.rightCorner = addMesh(mouthGroup, new THREE.SphereGeometry(0.035, 18, 12), materials.lip, [0.24, -0.015, 0.04], [1.18, 0.72, 0.54]);
  rig.teeth = addMesh(mouthGroup, new THREE.BoxGeometry(0.34, 0.055, 0.024), materials.teeth, [0, -0.012, 0.06], [1, 1, 1]);
  rig.tongue = addMesh(mouthGroup, new THREE.SphereGeometry(0.13, 32, 16), materials.tongue, [0, -0.105, 0.055], [1.2, 0.34, 0.32]);

  rig.materials = materials;
}

function buildScene() {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.07;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe6ecec);
  scene.fog = new THREE.Fog(0xe6ecec, 7.4, 11);

  if (RoomEnvironment) {
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
  }

  camera = new THREE.PerspectiveCamera(33, 1, 0.1, 100);
  camera.position.set(0, 0.54, 5.05);
  camera.lookAt(0, 0.35, 0);
  setCameraBase(new THREE.Vector3(0, 0.45, 0), 4.4);

  const hemi = new THREE.HemisphereLight(0xffffff, 0xa3a8a3, 1.15);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffffff, 2.1);
  key.position.set(-1.7, 2.4, 3.2);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xd6e8ff, 0.56);
  fill.position.set(2.7, 1.45, 2.4);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xffffff, 0.82);
  rim.position.set(0.9, 2.1, -2.8);
  scene.add(rim);

  const backWall = new THREE.Mesh(
    new THREE.PlaneGeometry(7.2, 7.2),
    new THREE.MeshStandardMaterial({ color: 0xe4ebeb, roughness: 0.96 }),
  );
  backWall.position.set(0, 0.7, -2.2);
  backWall.receiveShadow = true;
  scene.add(backWall);

  resizeRenderer();
}

function findObjectByName(root, names) {
  const lookup = new Set(names.map((name) => name.toLowerCase()));
  let found = null;
  root.traverse((child) => {
    if (!found && lookup.has(child.name.toLowerCase())) {
      found = child;
    }
  });
  return found;
}

function ensureMorphDictionary(mesh) {
  const morphCount = mesh.geometry?.morphAttributes?.position?.length || 0;
  if (!morphCount) return false;

  if (!mesh.morphTargetInfluences) {
    mesh.morphTargetInfluences = new Array(morphCount).fill(0);
  }

  if (!mesh.morphTargetDictionary) {
    mesh.morphTargetDictionary = {};
  }

  const targetNames = mesh.userData?.targetNames || mesh.geometry?.userData?.targetNames || [];
  targetNames.forEach((name, index) => {
    if (index < morphCount) mesh.morphTargetDictionary[name] = index;
  });

  return Object.keys(mesh.morphTargetDictionary).length > 0;
}

function tuneLoadedMaterial(mesh) {
  if (!mesh.isMesh) return;

  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const meshName = mesh.name.toLowerCase();
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  materials.filter(Boolean).forEach((material) => {
    const materialName = material.name?.toLowerCase() || "";
    const surfaceName = `${meshName} ${materialName}`;
    material.needsUpdate = true;
    if (material.map) material.map.colorSpace = THREE.SRGBColorSpace;
    if ("roughness" in material) material.roughness = clamp(material.roughness ?? 0.58, 0.34, 0.82);
    if ("metalness" in material) material.metalness = Math.min(material.metalness ?? 0, 0.08);
    if ("envMapIntensity" in material) material.envMapIntensity = 0.42;

    if (/outfit|suit|jacket|blazer|coat|casualsuit|pants|trouser/.test(surfaceName)) {
      if (material.color) material.color.setHex(0x182533);
      if ("roughness" in material) material.roughness = 0.66;
      if ("metalness" in material) material.metalness = 0.02;
      if ("envMapIntensity" in material) material.envMapIntensity = 0.28;
    }

    if (/shirt|collar|button/.test(surfaceName)) {
      if (material.color) material.color.setHex(0xf2f4ef);
      if ("roughness" in material) material.roughness = 0.58;
      if ("envMapIntensity" in material) material.envMapIntensity = 0.34;
    }

    if (/tie|necktie/.test(surfaceName)) {
      if (material.color) material.color.setHex(0x0c6552);
      if ("roughness" in material) material.roughness = 0.5;
      if ("envMapIntensity" in material) material.envMapIntensity = 0.32;
    }

    if (/shoe|footwear/.test(surfaceName)) {
      if (material.color) material.color.setHex(0x151719);
      if ("roughness" in material) material.roughness = 0.52;
      if ("envMapIntensity" in material) material.envMapIntensity = 0.34;
    }

    if (/eye|eyeball|brown_eye/.test(surfaceName)) {
      if ("roughness" in material) material.roughness = 0.18;
      if ("envMapIntensity" in material) material.envMapIntensity = 0.86;
    }

    if (/base|head|skin|human|avatarbody/.test(surfaceName)) {
      if ("roughness" in material) material.roughness = 0.62;
      if ("envMapIntensity" in material) material.envMapIntensity = 0.28;
    }
  });
}

function applyJohnPresentation(model) {
  model.traverse((child) => {
    const name = child.name.toLowerCase();
    if (/ponytail|braid|longhair/.test(name)) {
      child.visible = false;
    }
  });

  ["LeftBreast", "RightBreast"].forEach((name) => {
    const bone = findObjectByName(model, [name]);
    if (bone) bone.scale.setScalar(0.12);
  });
}

function collectMorphTargets(model) {
  const morphMeshes = [];
  const morphIndex = new Map();

  model.traverse((child) => {
    tuneLoadedMaterial(child);

    if (!child.isMesh || !ensureMorphDictionary(child)) return;
    morphMeshes.push(child);

    Object.entries(child.morphTargetDictionary).forEach(([name, index]) => {
      const key = name.toLowerCase();
      if (!morphIndex.has(key)) morphIndex.set(key, []);
      morphIndex.get(key).push({ mesh: child, index });
    });
  });

  const morphMap = {};
  Object.entries(MORPH_ALIASES).forEach(([key, aliases]) => {
    const matches = [];
    aliases.forEach((alias) => {
      const entries = morphIndex.get(alias.toLowerCase());
      if (entries) matches.push(...entries);
    });
    morphMap[key] = matches;
  });

  return {
    morphMeshes,
    morphMap,
    morphNames: Array.from(morphIndex.keys()).sort(),
  };
}

function setMorph(key, value) {
  const entries = rig.morphMap?.[key] || [];
  entries.forEach(({ mesh, index }) => {
    mesh.morphTargetInfluences[index] = clamp(value, 0, 1);
  });
}

function resetModelMorphs() {
  rig.morphMeshes?.forEach((mesh) => {
    mesh.morphTargetInfluences.fill(0);
  });
}

function frameCameraOnAvatar(group, headBone = null) {
  group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(group);
  const size = box.getSize(new THREE.Vector3());
  const target = box.getCenter(new THREE.Vector3());

  if (headBone) {
    headBone.getWorldPosition(target);
    target.y += size.y * 0.04;
  } else {
    target.y = box.max.y - size.y * 0.12;
  }

  const distance = clamp(size.y * 1.18, 3.45, 5.4);
  setCameraBase(target, distance);
  camera.near = 0.03;
  camera.far = 80;
  camera.updateProjectionMatrix();

  return {
    height: size.y,
    center: target,
    distance,
  };
}

function disposeObject(object) {
  if (!object) return;
  scene.remove(object);
  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.filter(Boolean).forEach((material) => {
      Object.values(material).forEach((value) => {
        if (value?.isTexture) value.dispose();
      });
      material.dispose?.();
    });
  });
}

async function loadAvatarCandidate(candidate) {
  if (!GLTFLoader) return false;

  const previousAvatar = avatarRoot;
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(candidate.url);
  const model = gltf.scene;
  const group = new THREE.Group();
  group.name = "RealisticAvatar";
  scene.add(group);
  group.add(model);
  applyJohnPresentation(model);

  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const scale = 3.05 / Math.max(size.y, 0.001);

  model.scale.setScalar(scale);
  model.position.set(-center.x * scale, -box.min.y * scale - 1.68, -center.z * scale);
  model.rotation.y = 0;

  const morphData = collectMorphTargets(model);
  const activeMorphs = Object.entries(morphData.morphMap)
    .filter(([, entries]) => entries.length)
    .map(([key]) => key);

  if (!morphData.morphMeshes.length || !activeMorphs.includes("jawOpen")) {
    disposeObject(group);
    setLog(`${candidate.name} loaded but did not expose usable facial morphs. Trying next model.`);
    return false;
  }

  const headBone = findObjectByName(model, ["Head", "head", "mixamorigHead", "Wolf3D_Head"]);
  const cameraFrame = frameCameraOnAvatar(group, headBone);

  avatarRoot = group;
  headGroup = null;
  rig = {
    mode: "gltf",
    model,
    group,
    modelName: candidate.name,
    morphMeshes: morphData.morphMeshes,
    morphMap: morphData.morphMap,
    morphNames: morphData.morphNames,
    headBone,
    neckBone: findObjectByName(model, ["Neck", "neck", "Neck1", "Neck2", "mixamorigNeck"]),
    jawBone: findObjectByName(model, ["Jaw", "jaw"]),
    leftEyeBone: findObjectByName(model, ["LeftEye", "leftEye", "EyeLeft", "mixamorigLeftEye"]),
    rightEyeBone: findObjectByName(model, ["RightEye", "rightEye", "EyeRight", "mixamorigRightEye"]),
  };
  rig.headBase = rig.headBone?.rotation.clone();
  rig.neckBase = rig.neckBone?.rotation.clone();
  rig.jawBase = rig.jawBone?.rotation.clone();
  rig.leftEyeBase = rig.leftEyeBone?.rotation.clone();
  rig.rightEyeBase = rig.rightEyeBone?.rotation.clone();

  if (previousAvatar && previousAvatar !== group) {
    previousAvatar.visible = false;
  }

  rendererStatus.value = "webgl glb";
  modelStatus.value = candidate.name;
  modeLabel.value = candidate.name;
  setLog(
    `Loaded ${candidate.name}. height=${cameraFrame.height.toFixed(2)}, camera=${cameraFrame.distance.toFixed(2)}. Driven morphs: ${activeMorphs.join(", ")}`,
  );
  return true;
}

async function loadRealisticAvatar() {
  if (!GLTFLoader) return false;
  const failures = [];

  for (const candidate of AVATAR_MODELS) {
    try {
      setStatus(`Loading ${candidate.name}`, "busy");
      modelStatus.value = candidate.name;
      setLog(`Loading ${candidate.name}...`);
      const loaded = await loadAvatarCandidate(candidate);
      if (loaded) return true;
      failures.push(`${candidate.name}: no facial morphs`);
    } catch (error) {
      console.warn(`${candidate.name} failed to load.`, error);
      failures.push(`${candidate.name}: ${error.message || error}`);
    }
  }

  setLog(`No GLB model loaded. ${failures.join(" | ")}`);
  return false;
}

function resizeRenderer() {
  if (!renderer || !camera) return;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(320, Math.floor(rect.width || 640));
  const height = Math.max(420, Math.floor(rect.height || width * 1.125));
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  applyCameraControls();
}

function voiceScore(voice, profile) {
  const descriptor = `${voice.name} ${voice.voiceURI} ${voice.lang}`.toLowerCase();
  let score = voice.lang.toLowerCase().startsWith("en") ? 20 : 0;
  if (profile.lang && voice.lang.toLowerCase().startsWith(profile.lang.toLowerCase())) score += 70;

  if (profile.prefer.test(descriptor)) score += 90;
  if (profile.avoid.test(descriptor)) score -= 75;
  if (/natural|neural|online|enhanced|premium|siri|google|microsoft/.test(descriptor)) score += 20;
  if (voice.localService === false) score += 8;
  if (/compact|novelty|whisper|zarvox|bells|boing|bad news|good news/.test(descriptor)) score -= 100;

  return score;
}

function bestVoiceForProfile(profile, availableVoices) {
  let selected = null;
  let selectedScore = -Infinity;

  availableVoices.forEach((voice) => {
    const score = voiceScore(voice, profile);
    if (score > selectedScore) {
      selected = voice;
      selectedScore = score;
    }
  });

  return selected;
}

function applyVoiceProfileDefaults() {
  const profile = VOICE_PROFILES[voiceSelect.value] || VOICE_PROFILES.male;
  rateInput.value = String(profile.rate);
  pitchInput.value = String(profile.pitch);
}

function populateVoices() {
  if (!("speechSynthesis" in window)) {
    voiceSelect.innerHTML = '<option value="male">Male</option><option value="female">Female</option>';
    ttsStatus.value = "unavailable";
    applyVoiceProfileDefaults();
    return;
  }

  voices = window.speechSynthesis.getVoices();
  const englishVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith("en"));
  const displayVoices = englishVoices.length ? englishVoices : voices;
  const selectedProfile = userSelectedVoice
    ? voiceSelect.value
    : (salesSettings.preferredVoice || voiceSelect.value || "britishMale");
  voiceSelect.innerHTML = "";
  voiceChoices = {};

  Object.entries(VOICE_PROFILES).forEach(([key, profile]) => {
    voiceChoices[key] = bestVoiceForProfile(profile, displayVoices);
  });

  Object.entries(VOICE_PROFILES).forEach(([key, profile]) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = profile.label;
    if (key === selectedProfile) {
      option.selected = true;
    }
    voiceSelect.append(option);
  });

  applyVoiceProfileDefaults();
  const selectedVoice = voiceChoices[voiceSelect.value];
  ttsStatus.value = selectedVoice ? selectedVoice.name : (displayVoices.length ? "browser voices" : "browser default");
}

async function refreshVoicesBeforeSpeech(selectedProfileKey) {
  populateVoices();
  if (voices.length && voiceChoices[selectedProfileKey]) return;

  await new Promise((resolve) => window.setTimeout(resolve, 300));
  populateVoices();
}

function tokenVisemes(word) {
  const clean = word.toLowerCase().replace(/[^a-z']/g, "");
  const output = [];
  let i = 0;

  const push = (viseme) => {
    if (output[output.length - 1] !== viseme) output.push(viseme);
  };

  while (i < clean.length) {
    const rest = clean.slice(i);

    if (rest.startsWith("tion") || rest.startsWith("sion")) {
      push("CH");
      push("nn");
      i += 4;
    } else if (rest.startsWith("th")) {
      push("TH");
      i += 2;
    } else if (rest.startsWith("ch") || rest.startsWith("sh")) {
      push("CH");
      i += 2;
    } else if (rest.startsWith("ph")) {
      push("FF");
      i += 2;
    } else if (rest.startsWith("qu")) {
      push("kk");
      push("U");
      i += 2;
    } else if (rest.startsWith("oo") || rest.startsWith("ew") || rest.startsWith("ue")) {
      push("U");
      i += 2;
    } else if (rest.startsWith("ow") || rest.startsWith("ou") || rest.startsWith("oa")) {
      push("O");
      i += 2;
    } else if (rest.startsWith("ee") || rest.startsWith("ea") || rest.startsWith("ai") || rest.startsWith("ay")) {
      push("E");
      i += 2;
    } else if (rest.startsWith("er") || rest.startsWith("ir") || rest.startsWith("ur")) {
      push("RR");
      i += 2;
    } else if (rest.startsWith("ar")) {
      push("aa");
      push("RR");
      i += 2;
    } else {
      const char = clean[i];
      if ("pbm".includes(char)) push("PP");
      else if ("fv".includes(char)) push("FF");
      else if ("td".includes(char)) push("DD");
      else if ("kgqc".includes(char)) push("kk");
      else if ("szx".includes(char)) push("SS");
      else if ("nl".includes(char)) push("nn");
      else if (char === "r") push("RR");
      else if (char === "w") push("U");
      else if (char === "a") push("aa");
      else if (char === "e") push("E");
      else if (char === "i" || char === "y") push("I");
      else if (char === "o") push("O");
      else if (char === "u") push("U");
      i += 1;
    }
  }

  return output.length ? output : ["sil"];
}

function visemeDuration(viseme, rate) {
  const base = {
    sil: 70,
    PP: 72,
    FF: 82,
    TH: 86,
    DD: 72,
    kk: 76,
    CH: 88,
    SS: 74,
    nn: 78,
    RR: 92,
    aa: 122,
    E: 105,
    I: 98,
    O: 118,
    U: 112,
  };
  return (base[viseme] || 88) / rate;
}

function buildVisemeSequence(text, rate) {
  const tokens = Array.from(text.matchAll(/[a-zA-Z']+|[.,!?;:]/g));
  const sequence = [];
  const wordAnchors = [];
  let time = 0;

  tokens.forEach((match) => {
    const token = match[0];
    const charIndex = match.index ?? 0;

    if (/^[.,!?;:]$/.test(token)) {
      const pause = /[.!?]/.test(token) ? 220 : 130;
      sequence.push({ viseme: "sil", start: time, end: time + pause / rate, token, charIndex });
      time += pause / rate;
      return;
    }

    wordAnchors.push({
      charIndex,
      sequenceIndex: sequence.length,
      start: time,
      token,
    });

    const shapes = tokenVisemes(token);
    shapes.forEach((viseme) => {
      const duration = visemeDuration(viseme, rate);
      sequence.push({ viseme, start: time, end: time + duration, token, charIndex });
      time += duration;
    });
    sequence.push({ viseme: "sil", start: time, end: time + 38 / rate, token, charIndex });
    time += 38 / rate;
  });

  if (!sequence.length) {
    sequence.push({ viseme: "sil", start: 0, end: 250, token: "", charIndex: 0 });
    time = 250;
  }

  return { sequence, duration: time, wordAnchors };
}

function blendVisemeShape(from, to, amount) {
  const output = {};
  Object.keys(VISEMES.sil).forEach((key) => {
    output[key] = lerp(from[key] ?? 0, to[key] ?? 0, amount);
  });
  return output;
}

function compactVisemeMix(entries) {
  const weights = new Map();
  entries.forEach(({ viseme, weight }) => {
    if (!viseme || weight <= 0.02) return;
    weights.set(viseme, (weights.get(viseme) || 0) + weight);
  });

  return Array.from(weights.entries())
    .map(([viseme, weight]) => ({ viseme, weight: clamp(weight, 0, 1) }))
    .sort((a, b) => b.weight - a.weight);
}

function selectCurrentViseme(now) {
  if (!state.speaking || !state.sequence.length) {
    return {
      viseme: "sil",
      shape: { ...VISEMES.sil },
      mix: [{ viseme: "sil", weight: 1 }],
      energy: 0,
    };
  }

  const elapsed = now - state.sequenceStart;
  if (elapsed < 0) {
    return {
      viseme: "sil",
      shape: { ...VISEMES.sil },
      mix: [{ viseme: "sil", weight: 1 }],
      energy: 0,
    };
  }

  while (
    state.sequenceCursor < state.sequence.length - 1 &&
    elapsed > state.sequence[state.sequenceCursor].end
  ) {
    state.sequenceCursor += 1;
  }

  if (elapsed > state.sequenceDuration + 250) {
    return {
      viseme: "sil",
      shape: { ...VISEMES.sil },
      mix: [{ viseme: "sil", weight: 1 }],
      energy: 0,
    };
  }

  const current = state.sequence[state.sequenceCursor] || state.sequence[0];
  const previous = state.sequence[state.sequenceCursor - 1];
  const next = state.sequence[state.sequenceCursor + 1];
  const duration = Math.max(1, current.end - current.start);
  const progress = clamp((elapsed - current.start) / duration, 0, 1);
  let shape = { ...VISEMES[current.viseme] };
  const mix = [{ viseme: current.viseme, weight: 1 }];

  if (previous) {
    const carry = (1 - smoothstep(0, 0.24, progress)) * 0.2;
    if (carry > 0.01) {
      shape = blendVisemeShape(shape, VISEMES[previous.viseme], carry);
      mix[0].weight -= carry * 0.45;
      mix.push({ viseme: previous.viseme, weight: carry * 0.45 });
    }
  }

  if (next) {
    const anticipationMax = next.viseme === "sil" ? 0.24 : 0.42;
    const anticipation = smoothstep(0.52, 1, progress) * anticipationMax;
    if (anticipation > 0.01) {
      shape = blendVisemeShape(shape, VISEMES[next.viseme], anticipation);
      mix[0].weight -= anticipation * 0.72;
      mix.push({ viseme: next.viseme, weight: anticipation * 0.72 });
    }
  }

  return {
    viseme: current.viseme,
    shape,
    mix: compactVisemeMix(mix),
    energy: clamp(shape.open * 0.8 + shape.teeth * 0.08 + shape.round * 0.12, 0, 1),
  };
}

function syncToSpeechBoundary(event) {
  if (!state.speaking || !state.wordAnchors.length || typeof event.charIndex !== "number") return;
  if (event.charIndex < state.lastBoundaryChar) return;

  const anchor = [...state.wordAnchors]
    .reverse()
    .find((item) => item.charIndex <= event.charIndex);

  if (!anchor) return;

  state.lastBoundaryChar = event.charIndex;
  state.sequenceCursor = anchor.sequenceIndex;
  state.sequenceStart = performance.now() - anchor.start + 24;
  syncStatus.value = "word sync";
}

function prepareSpeechSequence(text, rate) {
  const { sequence, duration, wordAnchors } = buildVisemeSequence(text, rate);
  state.sequence = sequence;
  state.wordAnchors = wordAnchors;
  state.sequenceCursor = 0;
  state.sequenceDuration = duration;
  state.sequenceStart = performance.now() + 80;
  state.lastBoundaryChar = -1;
  state.speaking = false;
  return { sequence, duration };
}

function beginSpeechAnimation(statusLabel = "Speaking") {
  autoSpeechStarting = false;
  autoPreListening = false;
  state.sequenceCursor = 0;
  state.lastBoundaryChar = -1;
  state.sequenceStart = performance.now();
  state.speaking = true;
  if (autoConversation) {
    holdMicForAvatarSpeech(Math.min(500, salesSettings.avatarEchoCooldownMs + 250));
    autoInterimTranscript = "";
    autoFinalTranscript = "";
    try {
      autoRecognition?.stop?.();
    } catch {
      // Recognition may already be stopped.
    }
  }
  setStatus(statusLabel, "busy");
  syncStatus.value = "active";
}

async function requestCustomerReply({ scenario, autoSpeak = false, forceRespond = false }) {
  const currentText = scenario.trim();
  if (activePersonality === "sales") recordCompletedSpeechTurn(currentText);
  generateButton.disabled = true;
  roleplayButton.disabled = true;
  setStatus("Generating reply", "busy");
  setLog(activePersonality === "kids" ? "Preparing John's answer." : "Asking DeepSeek for a customer response.");

  try {
    const localReply = await localKidsReply(currentText);
    if (localReply) {
      const localText = typeof localReply === "string" ? localReply : localReply.text;
      scriptInput.value = localText;
      caption.textContent = localText;
      rememberTurn("user", currentText);
      rememberTurn("john", localText);
      setStatus("Reply ready", "ready");
      setLog(localReply.provider || "local kids reply");
      if (autoSpeak) {
        await startSpeaking();
      }
      return typeof localReply === "string"
        ? { text: localText, provider: "local-kids", model: "local", shouldRespond: true }
        : localReply;
    }

    const response = await authFetch("/api/ai-sales/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scenario: currentText,
        personality: activePersonality,
        roleGuide: salesRoleGuide,
        conversation: conversationTurns,
        voice: voiceSelect.value || "male",
        expression: expressionSelect.value || "friendly",
        language: salesSettings.language,
        model: salesSettings.deepseekModel,
        doneProbabilityThreshold: salesSettings.doneProbability,
        maxTokens: salesSettings.maxCoachTokens,
        conversationTurns: salesSettings.conversationTurns,
        forceRespond,
      }),
    });
    const payload = await readJsonResponse(response);

    if (!response.ok) {
      throw new Error(payload.error || `DeepSeek request failed (${response.status})`);
    }

    if (payload.expression && EXPRESSIONS[payload.expression]) {
      expressionSelect.value = payload.expression;
      state.expression = payload.expression;
    }

    const doneProbability = Number(payload.doneProbability ?? 1);
    const doneProbabilityThreshold = clampProbability(payload.doneProbabilityThreshold, salesSettings.doneProbability);
    const shouldRespond = forceRespond
      ? payload.shouldRespond !== false
      : payload.shouldRespond !== false && doneProbability > doneProbabilityThreshold;

    if (!shouldRespond) {
      setStatus("Waiting for you", "ready");
      setLog(
          `provider: ${payload.provider || "ai"}\n` +
          `model: ${payload.model || "DeepSeek"}\n` +
          `done probability: ${(doneProbability * 100).toFixed(0)}%\n` +
          `threshold: ${(doneProbabilityThreshold * 100).toFixed(0)}%\n` +
          "Waiting for more speech because this was not a forced Auto turn.",
      );
      return { ...payload, doneProbability, shouldRespond: false };
    }

    scriptInput.value = payload.text || currentText;
    caption.textContent = scriptInput.value;
    rememberTurn(activePersonality === "kids" ? "child" : "salesperson", currentText);
    rememberTurn(activePersonality === "kids" ? "john" : "customer", scriptInput.value);
    if (activePersonality === "kids" && kidsMathGameActive && payload.activity) {
      showKidsActivity(payload.activity, false);
    } else if (activePersonality !== "kids") {
      hideKidsActivity();
    }
    setStatus("Reply ready", "ready");
    setLog(
      `provider: ${payload.provider || "ai"}\n` +
        `model: ${payload.model || "DeepSeek"}\n` +
        `done probability: ${(doneProbability * 100).toFixed(0)}%\n` +
        `threshold: ${(doneProbabilityThreshold * 100).toFixed(0)}%\n` +
        `${payload.text || ""}`,
    );
    if (autoSpeak) {
      await startSpeaking();
    }
    return { ...payload, doneProbability, shouldRespond: true };
  } catch (error) {
    setStatus("Reply generation failed", "bad");
    setLog(`DeepSeek generation failed: ${error.message || error}`);
    return { error, shouldRespond: false };
  } finally {
    generateButton.disabled = false;
    roleplayButton.disabled = autoConversation;
  }
}

async function generateCoachReply() {
  const currentText = scriptInput.value.trim();
  await requestCustomerReply({ scenario: currentText, autoSpeak: false });
}

async function generateRoleplayReply(transcript = userInput.value.trim(), autoSpeak = true) {
  if (!transcript) {
    setStatus("Add your line first", "warn");
    return;
  }
  userInput.value = transcript;
  updateSpeechMetrics(transcript);
  await requestCustomerReply({ scenario: transcript, autoSpeak });
}

async function speakWithBrowserTts(text, selectedProfileKey, voiceProfile, duration) {
  if (!("speechSynthesis" in window)) {
    beginSpeechAnimation("Speaking");
    scheduleAutoListenBeforeSpeechEnd(duration + 300);
    await new Promise(resolve => {
      window.setTimeout(() => {
        stopSpeaking(false);
        resolve();
      }, duration + 300);
    });
    return;
  }

  await refreshVoicesBeforeSpeech(selectedProfileKey);

  const utterance = new SpeechSynthesisUtterance(text);
  const selectedVoice = voiceChoices[selectedProfileKey] || null;
  if (selectedVoice) utterance.voice = selectedVoice;
  utterance.lang = selectedVoice?.lang || voiceProfile.lang || salesSettings.language || "en-US";
  ttsStatus.value = selectedVoice ? selectedVoice.name : "browser default";
  utterance.rate = voiceProfile.rate;
  utterance.pitch = voiceProfile.pitch;

  let speechFinished = false;
  let fallbackStopTimer = null;
  let resolveSpeech = () => {};
  const speechDone = new Promise(resolve => {
    resolveSpeech = resolve;
  });
  const finishSpeech = (cancelSpeech = false) => {
    if (speechFinished) return;
    speechFinished = true;
    if (fallbackStopTimer) window.clearTimeout(fallbackStopTimer);
    stopSpeaking(cancelSpeech);
    resolveSpeech();
  };

  utterance.onstart = () => {
    beginSpeechAnimation("Speaking");
  };

  utterance.onboundary = (event) => {
    syncToSpeechBoundary(event);
  };

  utterance.onend = () => {
    finishSpeech(false);
  };

  utterance.onerror = () => {
    finishSpeech(false);
    setStatus("Speech stopped", "warn");
  };

  state.utterance = utterance;
  beginSpeechAnimation("Speaking");
  scheduleAutoListenBeforeSpeechEnd(duration + 1200);
  fallbackStopTimer = window.setTimeout(() => finishSpeech(false), duration + 1200);

  try {
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    window.speechSynthesis.resume?.();
  } catch (error) {
    finishSpeech(false);
    setStatus("Speech failed", "bad");
    setLog(`Browser speech failed: ${error.message || error}`);
  }

  await speechDone;
}

function wait(ms) {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

async function fetchCloudflareTtsAudio(text) {
  let lastError = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await authFetch("/api/ai-sales/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          model: salesSettings.ttsModel,
          speaker: salesSettings.ttsSpeaker,
          encoding: "mp3",
        }),
      });

      if (!response.ok) {
        const payload = await readJsonResponse(response);
        throw new Error(payload.error || `Cloudflare TTS failed (${response.status})`);
      }

      const audioBlob = await response.blob();
      if (!audioBlob.size) {
        throw new Error("Cloudflare TTS returned empty audio.");
      }
      return audioBlob;
    } catch (error) {
      lastError = error;
      if (attempt < 1) {
        ttsStatus.value = `Cloudflare retry ${attempt + 1}`;
        await wait(180);
      }
    }
  }

  throw lastError || new Error("Cloudflare TTS failed.");
}

async function speakWithCloudflareTts(text, voiceProfile, duration) {
  setStatus("Generating voice", "busy");
  ttsStatus.value = "Cloudflare Aura-2";

  const audioBlob = await fetchCloudflareTtsAudio(text);

  const audio = new Audio();
  const objectUrl = URL.createObjectURL(audioBlob);
  let speechFinished = false;
  let fallbackStopTimer = null;
  let resolveSpeech = () => {};
  let rejectSpeech = () => {};
  const speechDone = new Promise((resolve, reject) => {
    resolveSpeech = resolve;
    rejectSpeech = reject;
  });

  const cleanupAudio = () => {
    if (fallbackStopTimer) window.clearTimeout(fallbackStopTimer);
    if (activeAudio === audio) activeAudio = null;
    try {
      audio.pause();
    } catch {
      // Audio may already be stopped.
    }
    if (audio.src.startsWith("blob:")) URL.revokeObjectURL(audio.src);
    audio.removeAttribute("src");
    if (activeAudioFrame) cancelAnimationFrame(activeAudioFrame);
    activeAudioFrame = null;
    activeAudioAnalyser = null;
    if (activeAudioContext && activeAudioContext.state !== "closed") {
      activeAudioContext.close().catch(() => {});
    }
    activeAudioContext = null;
    state.audioEnergy = 0;
  };

  const finishSpeech = () => {
    if (speechFinished) return;
    speechFinished = true;
    cleanupAudio();
    stopSpeaking(false);
    resolveSpeech();
  };

  const failSpeech = (message) => {
    if (speechFinished) return;
    speechFinished = true;
    cleanupAudio();
    stopSpeaking(false, autoConversation ? "Generating voice" : "Avatar ready");
    rejectSpeech(new Error(message));
  };

  activeAudio = audio;
  audio.src = objectUrl;
  audio.preload = "auto";
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    activeAudioContext = new AudioContextClass();
    const source = activeAudioContext.createMediaElementSource(audio);
    activeAudioAnalyser = activeAudioContext.createAnalyser();
    activeAudioAnalyser.fftSize = 512;
    activeAudioAnalyser.smoothingTimeConstant = 0.45;
    source.connect(activeAudioAnalyser);
    activeAudioAnalyser.connect(activeAudioContext.destination);
    const samples = new Uint8Array(activeAudioAnalyser.fftSize);
    const sampleSpeechEnergy = () => {
      if (!activeAudioAnalyser || activeAudio !== audio) return;
      activeAudioAnalyser.getByteTimeDomainData(samples);
      let sum = 0;
      for (const sample of samples) {
        const centered = (sample - 128) / 128;
        sum += centered * centered;
      }
      state.audioEnergy = Math.min(1, Math.sqrt(sum / samples.length) * 5.5);
      activeAudioFrame = requestAnimationFrame(sampleSpeechEnergy);
    };
    sampleSpeechEnergy();
  } catch {
    activeAudioContext = null;
    activeAudioAnalyser = null;
  }
  audio.onloadedmetadata = () => {
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      const audioDurationMs = audio.duration * 1000;
      state.sequenceDuration = audioDurationMs;
      scheduleAutoListenBeforeSpeechEnd(audioDurationMs);
      fallbackStopTimer = window.setTimeout(finishSpeech, audioDurationMs + 1200);
    }
  };
  audio.onplay = () => {
    syncStatus.value = "cloudflare audio";
  };
  audio.onended = finishSpeech;
  audio.onerror = () => {
    failSpeech("Cloudflare audio playback failed.");
  };

  beginSpeechAnimation("Speaking");
  scheduleAutoListenBeforeSpeechEnd(duration + 1800);
  fallbackStopTimer = window.setTimeout(finishSpeech, duration + 1800);
  try {
    await audio.play();
  } catch (error) {
    if (!speechFinished) {
      speechFinished = true;
      cleanupAudio();
      stopSpeaking(false, autoConversation ? "Generating voice" : "Avatar ready");
    }
    throw error;
  }
  ttsStatus.value = `${salesSettings.ttsSpeaker} via Aura-2`;
  await speechDone;
}

async function startSpeaking() {
  const text = scriptInput.value.trim();
  if (!text) {
    setStatus("Add a line first", "warn");
    return;
  }

  autoSpeechStarting = autoConversation;
  stopSpeaking(true, autoConversation ? "Generating voice" : "Avatar ready");
  const runId = speechRunId;
  state.expression = expressionSelect.value;
  caption.textContent = text;

  applyVoiceProfileDefaults();
  const selectedProfileKey = voiceSelect.value || "male";
  const voiceProfile = VOICE_PROFILES[selectedProfileKey] || VOICE_PROFILES.male;
  const { sequence, duration } = prepareSpeechSequence(text, voiceProfile.rate);

  setStatus("Speaking", "busy");
  speakButton.disabled = true;
  syncStatus.value = "browser speech";
  setLog(`visemes: ${sequence.map((item) => item.viseme).join(" ")}`);

  if (runId !== speechRunId) return;
  if (salesSettings.ttsProvider.toLowerCase() === "cloudflare") {
    try {
      syncStatus.value = "cloudflare speech";
      await speakWithCloudflareTts(text, voiceProfile, duration);
      return;
    } catch (error) {
      setLog(`Cloudflare voice unavailable after retries. Speaking with browser voice instead: ${error.message || error}`);
      syncStatus.value = "browser fallback";
    }
  }

  await speakWithBrowserTts(text, selectedProfileKey, voiceProfile, duration);
}

function stopSpeaking(cancelSpeech = true, nextStatus = autoConversation ? "Listening" : "Avatar ready") {
  speechRunId += 1;
  if (autoEarlyListenTimer) {
    window.clearTimeout(autoEarlyListenTimer);
    autoEarlyListenTimer = null;
  }
  if (activeAudio) {
    const audio = activeAudio;
    activeAudio = null;
    audio.pause();
    if (audio.src.startsWith("blob:")) URL.revokeObjectURL(audio.src);
    audio.removeAttribute("src");
  }
  if (activeAudioFrame) cancelAnimationFrame(activeAudioFrame);
  activeAudioFrame = null;
  activeAudioAnalyser = null;
  if (activeAudioContext && activeAudioContext.state !== "closed") {
    activeAudioContext.close().catch(() => {});
  }
  activeAudioContext = null;

  if (cancelSpeech && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }

  state.speaking = false;
  if (autoConversation) {
    autoPreListening = false;
    holdMicForAvatarSpeech(salesSettings.avatarEchoCooldownMs);
    autoInterimTranscript = "";
  }
  state.utterance = null;
  state.sequence = [];
  state.wordAnchors = [];
  state.sequenceCursor = 0;
  state.lastBoundaryChar = -1;
  state.viseme = "sil";
  state.visemeMix = [{ viseme: "sil", weight: 1 }];
  state.speechEnergy = 0;
  state.audioEnergy = 0;
  speakButton.disabled = false;
  syncStatus.value = "idle";
  visemeStatus.value = "sil";

  if (statusDot.dataset.tone !== "bad") {
    setStatus(nextStatus, "ready");
  }
}

function blinkAmount(now) {
  const duration = 170;
  const elapsed = now - state.blinkStart;
  if (elapsed < 0 || elapsed > duration) return 0;
  const half = duration / 2;
  return elapsed < half ? elapsed / half : 1 - (elapsed - half) / half;
}

function updateBehavior(now) {
  const expression = EXPRESSIONS[state.expression] || EXPRESSIONS.friendly;
  const frame = selectCurrentViseme(now);
  const target = { ...frame.shape, smile: expression.smile };
  if (state.speaking && state.audioEnergy > 0.02) {
    target.open = clamp(target.open * 0.62 + state.audioEnergy * 0.38, 0.008, 0.88);
  }

  state.viseme = frame.viseme;
  state.visemeMix = frame.mix;
  state.speechEnergy = state.speaking && state.audioEnergy > 0.02
    ? lerp(frame.energy, state.audioEnergy, 0.58)
    : frame.energy;
  state.mouthTarget = target;

  const smoothing = state.speaking ? 0.38 : 0.14;
  Object.keys(state.mouth).forEach((key) => {
    state.mouth[key] = lerp(state.mouth[key], state.mouthTarget[key] ?? 0, smoothing);
  });

  if (now > state.nextBlink) {
    state.blinkStart = now;
    state.nextBlink = now + randomRange(2600, 6100);
  }

  if (now > state.nextGaze) {
    const glanceAway = Math.random() < 0.18 && !state.speaking;
    state.gazeTargetX = glanceAway ? randomRange(-0.32, 0.32) : randomRange(-0.07, 0.07);
    state.gazeTargetY = glanceAway ? randomRange(-0.12, 0.08) : randomRange(-0.045, 0.045);
    state.nextGaze = now + randomRange(glanceAway ? 450 : 1800, glanceAway ? 900 : 4200);
  }

  state.gazeX = lerp(state.gazeX, state.gazeTargetX, 0.035);
  state.gazeY = lerp(state.gazeY, state.gazeTargetY, 0.035);
  visemeStatus.value = frame.viseme;
}

function applyProceduralRig(now) {
  if (!headGroup || !rig.mouthGroup) return;

  const expression = EXPRESSIONS[state.expression] || EXPRESSIONS.friendly;
  const blink = blinkAmount(now);
  const idleBreath = Math.sin(now / 1200);
  const idleSlow = Math.sin(now / 2200);
  const speechEnergy = state.speaking ? smoothstep(0.08, 0.8, state.mouth.open) : 0;
  const eyeOpen = clamp(expression.eye * (1 - blink * 0.94) - (expression.squint || 0) * 0.22, 0.04, 1);

  headGroup.rotation.x = expression.tilt * 0.25 + idleBreath * 0.012 - state.gazeY * 0.015;
  headGroup.rotation.y = state.gazeX * 0.045 + idleSlow * 0.018;
  headGroup.rotation.z = expression.tilt + idleBreath * 0.006;
  avatarRoot.position.y = -1.15 + idleBreath * 0.018;

  rig.irises.forEach((iris, index) => {
    const side = index === 0 ? -1 : 1;
    iris.position.x = side * 0.27 + state.gazeX * 0.012;
    iris.position.y = 0.14 + state.gazeY * 0.012;
    rig.pupils[index].position.x = side * 0.27 + state.gazeX * 0.015;
    rig.pupils[index].position.y = 0.14 + state.gazeY * 0.015;
  });

  rig.lids.forEach(({ upper, lower }) => {
    upper.position.y = 0.14 + 0.082 * eyeOpen;
    upper.scale.y = 0.7 + (1 - eyeOpen) * 2.0;
    lower.position.y = 0.065 + (1 - eyeOpen) * 0.035;
    lower.scale.y = 0.62 + (1 - eyeOpen) * 1.35;
  });

  rig.brows.forEach(({ mesh, side }) => {
    const inner = expression.browInner * 0.06;
    const asym = expression.browAsym * side * 0.05;
    mesh.position.y = 0.34 + expression.browLift * 0.12 + asym - inner - (expression.browDown || 0) * 0.08;
    mesh.rotation.z = Math.PI / 2 + side * (-0.08 - expression.browInner * 0.18) + expression.browAsym * 0.12;
  });

  const mouth = state.mouth;
  const open = clamp(mouth.open, 0, 1);
  const round = clamp(mouth.round, 0, 1);
  const smile = clamp(mouth.smile, -0.35, 0.75);
  const press = clamp(mouth.press, 0, 1);
  const width = clamp(0.38 + mouth.width * 0.42 - round * 0.22, 0.28, 0.78);
  const height = clamp(0.026 + open * 0.34 - press * 0.02, 0.012, 0.38);
  const pucker = round * 0.075;
  const cornerLift = smile * 0.09 - open * 0.018;

  rig.mouthInterior.position.y = -0.032 - open * 0.105 + press * 0.02;
  rig.mouthInterior.position.z = 0.005 + pucker;
  rig.mouthInterior.scale.set(width * 1.08, height, 0.26 + round * 0.34);
  rig.mouthInterior.visible = open > 0.035 || press < 0.55;

  rig.upperLip.position.y = 0.02 + open * 0.018 - press * 0.01;
  rig.upperLip.position.z = 0.04 + pucker;
  rig.upperLip.scale.set(width * 1.05, 1 + round * 0.18, 0.9 + round * 0.5);
  rig.upperLip.rotation.y = -round * 0.08;

  rig.lowerLip.position.y = -0.045 - open * 0.17 + press * 0.024;
  rig.lowerLip.position.z = 0.045 + pucker;
  rig.lowerLip.scale.set(width * 1.07, 1 + open * 0.28 + round * 0.2, 0.94 + round * 0.5);
  rig.lowerLip.rotation.y = -round * 0.08;

  rig.leftCorner.position.set(-width * 0.34, -0.018 + cornerLift, 0.045 + pucker * 0.55);
  rig.rightCorner.position.set(width * 0.34, -0.018 + cornerLift, 0.045 + pucker * 0.55);
  rig.leftCorner.scale.set(1.05 + smile * 0.2, 0.68 + open * 0.28, 0.55);
  rig.rightCorner.scale.copy(rig.leftCorner.scale);

  rig.teeth.visible = mouth.teeth > 0.12 && open > 0.045;
  rig.teeth.position.y = -0.008 - open * 0.036;
  rig.teeth.position.z = 0.068 + pucker * 0.3;
  rig.teeth.scale.set(width * 1.05, clamp(0.55 + mouth.teeth, 0.6, 1.28), 1);
  rig.teeth.material.opacity = clamp(mouth.teeth, 0.2, 0.9);

  rig.tongue.visible = mouth.tongue > 0.18 || open > 0.5;
  rig.tongue.position.y = -0.11 - open * 0.06 + mouth.tongue * 0.025;
  rig.tongue.position.z = 0.056 + pucker * 0.2;
  rig.tongue.scale.set(width * 0.8, 0.3 + open * 0.46 + mouth.tongue * 0.28, 0.3);
  rig.tongue.material.opacity = clamp(open + mouth.tongue * 0.34, 0.28, 0.78);

  rig.cheeks.forEach((cheek, index) => {
    const side = index === 0 ? -1 : 1;
    cheek.position.y = -0.115 + smile * 0.03;
    cheek.position.x = side * (0.31 + smile * 0.015);
    cheek.scale.y = 0.5 + smile * 0.12 + speechEnergy * 0.04;
  });
}

function applyModelRig(now) {
  if (rig.mode !== "gltf") return;

  const expression = EXPRESSIONS[state.expression] || EXPRESSIONS.friendly;
  const blink = blinkAmount(now);
  const idleBreath = Math.sin(now / 1200);
  const idleSlow = Math.sin(now / 2200);
  const mouth = state.mouth;
  const open = clamp(mouth.open, 0, 1);
  const round = clamp(mouth.round, 0, 1);
  const smile = clamp(mouth.smile, -0.35, 0.75);
  const press = clamp(mouth.press, 0, 1);
  const eyeOpen = clamp(expression.eye * (1 - blink * 0.96), 0, 1);
  const squint = clamp(expression.squint || 0, 0, 0.6);
  const browDown = clamp(expression.browDown || 0, 0, 0.8);
  const sneer = clamp(expression.sneer || 0, 0, 0.8);
  const articulationSide = state.speaking ? Math.sin(now / 86) * open * 0.06 : 0;
  const mouthSide = clamp((expression.mouthSide || 0) + articulationSide, -0.5, 0.5);

  resetModelMorphs();

  const visemeMix = state.visemeMix?.length ? state.visemeMix : [{ viseme: state.viseme, weight: 1 }];
  visemeMix.forEach(({ viseme, weight }) => {
    const morph = VISEME_MORPH[viseme] || "visemeSil";
    const intensity = viseme === "sil" ? 0.06 * weight : clamp(0.42 + open * 0.48, 0.32, 0.9) * weight;
    setMorph(morph, intensity);
  });

  setMorph("jawOpen", clamp(open * 0.68, 0, 0.74));
  setMorph("mouthClose", clamp(press * 0.78, 0, 0.9));
  setMorph("mouthFunnel", clamp(round * 0.46 + (state.viseme === "RR" ? 0.16 : 0), 0, 0.68));
  setMorph("mouthPucker", clamp(round * 0.6, 0, 0.74));
  setMorph("mouthStretchLeft", clamp((mouth.width - 0.5) * 1.45, 0, 0.46));
  setMorph("mouthStretchRight", clamp((mouth.width - 0.5) * 1.45, 0, 0.46));
  setMorph("mouthDimpleLeft", clamp(smile * 0.3 + Math.max(0, -mouthSide) * 0.38, 0, 0.45));
  setMorph("mouthDimpleRight", clamp(smile * 0.3 + Math.max(0, mouthSide) * 0.38, 0, 0.45));
  setMorph("mouthLeft", clamp(Math.max(0, -mouthSide), 0, 0.55));
  setMorph("mouthRight", clamp(Math.max(0, mouthSide), 0, 0.55));
  setMorph("mouthPressLeft", clamp(press * 0.85, 0, 1));
  setMorph("mouthPressRight", clamp(press * 0.85, 0, 1));
  setMorph("mouthRollUpper", clamp(round * 0.15 + press * 0.32, 0, 0.5));
  setMorph("mouthRollLower", clamp(round * 0.12 + press * 0.2, 0, 0.45));
  setMorph("tongueOut", clamp(mouth.tongue * 0.72, 0, 0.85));

  if (smile >= 0) {
    setMorph("mouthSmileLeft", clamp(smile * 0.95, 0, 0.75));
    setMorph("mouthSmileRight", clamp(smile * 0.95, 0, 0.75));
  } else {
    setMorph("mouthFrownLeft", clamp(-smile * 0.8, 0, 0.48));
    setMorph("mouthFrownRight", clamp(-smile * 0.8, 0, 0.48));
  }

  setMorph("blinkLeft", clamp(1 - eyeOpen, 0, 1));
  setMorph("blinkRight", clamp(1 - eyeOpen, 0, 1));
  setMorph("browInner", clamp(expression.browInner * 0.8 + expression.browLift * 0.28, 0, 0.72));
  setMorph("browOuterLeft", clamp(expression.browLift * 0.45 + expression.browAsym * 0.24, 0, 0.72));
  setMorph("browOuterRight", clamp(expression.browLift * 0.45 - expression.browAsym * 0.24, 0, 0.72));
  setMorph("browDownLeft", clamp(browDown + expression.browInner * 0.18 - expression.browLift * 0.12, 0, 0.72));
  setMorph("browDownRight", clamp(browDown + expression.browInner * 0.18 - expression.browLift * 0.12, 0, 0.72));
  setMorph("eyeSquintLeft", clamp(squint + smile * 0.16 + open * 0.04, 0, 0.55));
  setMorph("eyeSquintRight", clamp(squint + smile * 0.16 + open * 0.04, 0, 0.55));
  setMorph("cheekSquintLeft", clamp(smile * 0.28 + squint * 0.26, 0, 0.45));
  setMorph("cheekSquintRight", clamp(smile * 0.28 + squint * 0.26, 0, 0.45));
  setMorph("noseSneerLeft", clamp(sneer * 0.72 + Math.max(0, -mouthSide) * 0.22, 0, 0.75));
  setMorph("noseSneerRight", clamp(sneer * 0.72 + Math.max(0, mouthSide) * 0.22, 0, 0.75));

  const gazeUp = clamp(state.gazeY, 0, 1);
  const gazeDown = clamp(-state.gazeY, 0, 1);
  const gazeRight = clamp(state.gazeX, 0, 1);
  const gazeLeft = clamp(-state.gazeX, 0, 1);
  setMorph("eyeLookUpLeft", gazeUp * 0.34);
  setMorph("eyeLookUpRight", gazeUp * 0.34);
  setMorph("eyeLookDownLeft", gazeDown * 0.34);
  setMorph("eyeLookDownRight", gazeDown * 0.34);
  setMorph("eyeLookInLeft", gazeRight * 0.22);
  setMorph("eyeLookOutLeft", gazeLeft * 0.22);
  setMorph("eyeLookOutRight", gazeRight * 0.22);
  setMorph("eyeLookInRight", gazeLeft * 0.22);

  if (rig.headBone && rig.headBase) {
    const speechNod = state.speaking ? Math.sin(now / 240) * state.speechEnergy * 0.018 : 0;
    rig.headBone.rotation.x = rig.headBase.x + expression.tilt * 0.18 + idleBreath * 0.012 - state.gazeY * 0.035 + speechNod;
    rig.headBone.rotation.y = rig.headBase.y + state.gazeX * 0.12 + idleSlow * 0.025 + articulationSide * 0.08;
    rig.headBone.rotation.z = rig.headBase.z + expression.tilt * 0.55 + idleBreath * 0.008;
  }

  if (rig.neckBone && rig.neckBase) {
    rig.neckBone.rotation.x = rig.neckBase.x + idleBreath * 0.006;
    rig.neckBone.rotation.y = rig.neckBase.y + state.gazeX * 0.035;
    rig.neckBone.rotation.z = rig.neckBase.z + expression.tilt * 0.18;
  }

  if (rig.jawBone && rig.jawBase) {
    rig.jawBone.rotation.x = rig.jawBase.x + open * 0.18;
    rig.jawBone.rotation.y = rig.jawBase.y;
    rig.jawBone.rotation.z = rig.jawBase.z;
  }

  [
    [rig.leftEyeBone, rig.leftEyeBase],
    [rig.rightEyeBone, rig.rightEyeBase],
  ].forEach(([bone, base]) => {
    if (!bone || !base) return;
    bone.rotation.x = base.x - state.gazeY * 0.16;
    bone.rotation.y = base.y + state.gazeX * 0.18;
  });

  rig.group.position.y = idleBreath * 0.012;
}

function applyRig(now) {
  if (rig.mode === "gltf") {
    applyModelRig(now);
    return;
  }

  applyProceduralRig(now);
}

function animate(now) {
  updateBehavior(now);
  applyRig(now);
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

async function checkHealth() {
  try {
    const response = await authFetch("/api/ai-sales/health");
    const health = await response.json();
    rendererStatus.value = rig.mode === "gltf" ? "webgl glb" : health.renderer?.engine?.includes("Three") ? "webgl" : "ready";
    modelStatus.value = rig.mode === "gltf" ? rig.modelName || health.renderer?.model || "loaded" : "procedural fallback";
    ttsStatus.value = health.speech?.available ? "browser voices" : "browser default";
    syncStatus.value = "idle";
    modeLabel.value = rig.mode === "gltf" ? rig.modelName || "realistic glb" : "3d fallback";
  } catch {
    rendererStatus.value = rig.mode === "gltf" ? "webgl glb" : "webgl";
    modelStatus.value = rig.mode === "gltf" ? rig.modelName || "loaded" : "procedural fallback";
  }
}

async function init() {
  rendererStatus.value = "loading";
  setStatus("Loading 3D renderer", "busy");
  await loadSalesSettings();
  await setPersonality(personalitySelect?.value || "sales");

  try {
    THREE = await import("./vendor/three/three.module.js");
    ({ GLTFLoader } = await import("./vendor/three/examples/jsm/loaders/GLTFLoader.js"));
    try {
      ({ RoomEnvironment } = await import("./vendor/three/examples/jsm/environments/RoomEnvironment.js"));
    } catch {
      RoomEnvironment = null;
    }
  } catch (error) {
    console.error(error);
    rendererStatus.value = "unavailable";
    setStatus("Three.js failed to load", "bad");
    setLog(`The local Three.js modules failed to load: ${error.message || error}`);
    return;
  }

  buildScene();
  window.addEventListener("resize", resizeRenderer);
  [cameraXInput, cameraYInput, cameraDistanceInput, cameraAngleInput].forEach((input) => {
    input?.addEventListener("input", applyCameraControls);
  });
  cameraResetButton?.addEventListener("click", resetCameraControls);
  rendererStatus.value = "webgl loading";
  modelStatus.value = "loading John";
  modeLabel.value = "loading model";
  setLog("Loading the high-detail John model.");
  requestAnimationFrame(animate);

  const loadedModel = await loadRealisticAvatar();
  if (!loadedModel) {
    buildAvatar();
    fallbackAvatarRoot = avatarRoot;
    rendererStatus.value = "webgl fallback";
    modelStatus.value = "procedural fallback";
    modeLabel.value = "3d fallback";
    setLog("The realistic GLB did not load, so the app is using the procedural fallback avatar.");
  }

  populateVoices();
  if ("speechSynthesis" in window) {
    window.speechSynthesis.onvoiceschanged = populateVoices;
  }

  expressionSelect.addEventListener("change", () => {
    state.expression = expressionSelect.value;
  });
  personalitySelect?.addEventListener("change", () => {
    if (autoConversation) stopAutoConversation();
    setPersonality(personalitySelect.value);
  });
  voiceSelect.addEventListener("change", () => {
    userSelectedVoice = true;
    applyVoiceProfileDefaults();
    const selectedVoice = voiceChoices[voiceSelect.value];
    if (selectedVoice) ttsStatus.value = selectedVoice.name;
  });
  userInput.addEventListener("input", () => updateSpeechMetrics(userInput.value));
  cameraButton.addEventListener("click", startRepCamera);
  autoConversationButton.addEventListener("click", toggleAutoConversation);
  listenButton.addEventListener("click", startListening);
  stopListenButton.addEventListener("click", stopListening);
  roleplayButton.addEventListener("click", () => generateRoleplayReply(userInput.value.trim(), true));
  generateButton.addEventListener("click", generateCoachReply);
  speakButton.addEventListener("click", startSpeaking);
  stopButton.addEventListener("click", () => stopSpeaking(true));
  demoButton.addEventListener("click", () => {
    const demo = demos[Math.floor(Math.random() * demos.length)];
    scriptInput.value = demo.text;
    caption.textContent = demo.text;
    expressionSelect.value = demo.expression;
    state.expression = demo.expression;
  });

  setStatus("Avatar ready", "ready");
  if (loadedModel) {
    setLog("Realistic GLB avatar ready. Real-time visemes drive mouth, brows, gaze, head motion, and blinking.");
  }
  checkHealth();
}

init();
