import { useState } from "react";
import "./App.css";

function App() {
  // =========================================================
  // STATES
  // =========================================================

  const [step, setStep] = useState(1);
  const [language, setLanguage] = useState("English");
  const [submitted, setSubmitted] = useState(false);
  const [interactionMode, setInteractionMode] = useState("Tap");
  const [listening, setListening] = useState(false);

  const [patient, setPatient] = useState({
    name: "",
    age: "",
    gender: "",
  });

  const [symptoms, setSymptoms] = useState([]);

  // =========================================================
  // LANGUAGES
  // =========================================================

  const languages = [
    "English",
    "हिन्दी",
    "தமிழ்",
    "తెలుగు",
    "বাংলা",
  ];

  // =========================================================
  // TRANSLATIONS
  // =========================================================

  const translations = {
    English: {
      aiClinical: "AI Clinical Intake",
      kioskReady: "Kiosk Ready",

      welcome: "Welcome to Patient MediKiosk",
      welcomeSubtitle:
        "Let's collect some information before your consultation.",

      selectLanguage: "Select your language",

      talk: "Talk",
      talkDescription: "Answer questions using your voice",

      tap: "Tap",
      tapDescription: "Choose answers on the screen",

      voiceSelected:
        "Voice mode selected. You can answer using your microphone.",

      startHealthCheck: "Start Health Check",

      needHelp: "Need help? Ask hospital staff",

      patientInformation: "Patient Information",
      patientSubtitle:
        "Please enter your basic information before we continue.",

      fullName: "Full Name",
      enterFullName: "Enter your full name",

      age: "Age",
      enterAge: "Enter your age",

      gender: "Gender",
      selectGender: "Select gender",

      male: "Male",
      female: "Female",
      other: "Other",

      continue: "Continue",
      back: "← Back",

      microphoneInstruction:
        "Tap the microphone and speak your answer.",

      listening: "🔴 Listening... Please speak now.",

      symptomsTitle: "What brings you here today?",
      symptomsSubtitle:
        "Select the symptoms or reason for your visit.",

      tellSymptoms: "Tell me your symptoms",

      symptomExample:
        'Example: "I have cough and fever"',

      selected: "Selected:",

      review: "Review Your Information",
      reviewSubtitle:
        "Please check your information before continuing.",

      name: "Name",
      language: "Language",
      mode: "Mode",
      symptoms: "Symptoms",

      submit: "Submit",

      completed: "Health Check Completed",
      completedSubtitle:
        "Your health information has been submitted successfully.",

      patient: "Patient",
      status: "Status",
      submitted: "Submitted ✓",

      waitMessage:
        "Please wait for a healthcare professional to review your information.",

      startNew: "Start New Health Check",

      footer:
        "Your information will be reviewed by a healthcare professional before being added to your medical record.",

      voiceNotSupported:
        "Voice input is not supported in this browser. Please use Chrome.",

      voiceError:
        "Voice could not be detected. Please try again.",

      enterName:
        "Please enter your name",

      validAge:
        "Please enter a valid age",

      selectGenderError:
        "Please select your gender",

      selectSymptomError:
        "Please select at least one symptom",

      ageVoiceError:
        "Please say your age clearly.",

      symptomNotRecognised:
        "Symptom not recognised. Please try again.",
    },

    "हिन्दी": {
      aiClinical: "AI क्लिनिकल इनटेक",
      kioskReady: "कियोस्क तैयार",

      welcome: "MediKiosk में आपका स्वागत है",
      welcomeSubtitle:
        "परामर्श से पहले कुछ जानकारी एकत्र करते हैं।",

      selectLanguage: "अपनी भाषा चुनें",

      talk: "बोलें",
      talkDescription: "अपनी आवाज़ से सवालों का जवाब दें",

      tap: "टैप करें",
      tapDescription: "स्क्रीन पर उत्तर चुनें",

      voiceSelected:
        "वॉइस मोड चुना गया है। आप माइक्रोफ़ोन से जवाब दे सकते हैं।",

      startHealthCheck: "हेल्थ चेक शुरू करें",

      needHelp: "मदद चाहिए? अस्पताल के स्टाफ से पूछें",

      patientInformation: "मरीज़ की जानकारी",
      patientSubtitle:
        "आगे बढ़ने से पहले अपनी मूल जानकारी दर्ज करें।",

      fullName: "पूरा नाम",
      enterFullName: "अपना पूरा नाम दर्ज करें",

      age: "उम्र",
      enterAge: "अपनी उम्र दर्ज करें",

      gender: "लिंग",
      selectGender: "लिंग चुनें",

      male: "पुरुष",
      female: "महिला",
      other: "अन्य",

      continue: "जारी रखें",
      back: "← वापस",

      microphoneInstruction:
        "माइक्रोफ़ोन दबाएँ और अपना जवाब बोलें।",

      listening: "🔴 सुन रहा है... कृपया बोलें।",

      symptomsTitle: "आज आप यहाँ क्यों आए हैं?",
      symptomsSubtitle:
        "अपने लक्षण या आने का कारण चुनें।",

      tellSymptoms: "अपने लक्षण बताएं",

      symptomExample:
        'उदाहरण: "मुझे खांसी और बुखार है"',

      selected: "चयनित:",

      review: "अपनी जानकारी की समीक्षा करें",
      reviewSubtitle:
        "आगे बढ़ने से पहले अपनी जानकारी जाँच लें।",

      name: "नाम",
      language: "भाषा",
      mode: "मोड",
      symptoms: "लक्षण",

      submit: "सबमिट करें",

      completed: "हेल्थ चेक पूरा हुआ",
      completedSubtitle:
        "आपकी स्वास्थ्य जानकारी सफलतापूर्वक सबमिट हो गई है।",

      patient: "मरीज़",
      status: "स्थिति",
      submitted: "सबमिट हो गया ✓",

      waitMessage:
        "कृपया स्वास्थ्य कर्मचारी द्वारा आपकी जानकारी की समीक्षा करने तक प्रतीक्षा करें।",

      startNew: "नया हेल्थ चेक शुरू करें",

      footer:
        "आपकी जानकारी को मेडिकल रिकॉर्ड में जोड़ने से पहले स्वास्थ्य कर्मचारी द्वारा इसकी समीक्षा की जाएगी।",

      voiceNotSupported:
        "इस ब्राउज़र में वॉइस इनपुट उपलब्ध नहीं है। कृपया Chrome का उपयोग करें।",

      voiceError:
        "आवाज़ पहचानी नहीं जा सकी। कृपया फिर से प्रयास करें।",

      enterName:
        "कृपया अपना नाम दर्ज करें",

      validAge:
        "कृपया सही उम्र दर्ज करें",

      selectGenderError:
        "कृपया अपना लिंग चुनें",

      selectSymptomError:
        "कृपया कम से कम एक लक्षण चुनें",

      ageVoiceError:
        "कृपया अपनी उम्र स्पष्ट रूप से बोलें।",

      symptomNotRecognised:
        "लक्षण पहचाना नहीं गया। कृपया फिर से प्रयास करें।",
    },

    "தமிழ்": {
      aiClinical: "AI மருத்துவ தகவல் சேகரிப்பு",
      kioskReady: "கியோஸ்க் தயாராக உள்ளது",

      welcome: "MediKiosk-க்கு வரவேற்கிறோம்",
      welcomeSubtitle:
        "ஆலோசனைக்கு முன் சில தகவல்களை சேகரிப்போம்.",

      selectLanguage: "உங்கள் மொழியைத் தேர்ந்தெடுக்கவும்",

      talk: "பேசுங்கள்",
      talkDescription: "உங்கள் குரலைப் பயன்படுத்தி பதிலளிக்கவும்",

      tap: "தட்டவும்",
      tapDescription: "திரையில் பதில்களைத் தேர்ந்தெடுக்கவும்",

      voiceSelected:
        "குரல் முறை தேர்ந்தெடுக்கப்பட்டுள்ளது. மைக்ரோஃபோனைப் பயன்படுத்தி பதிலளிக்கலாம்.",

      startHealthCheck: "சுகாதார பரிசோதனையைத் தொடங்கவும்",

      needHelp: "உதவி தேவையா? மருத்துவமனை ஊழியர்களிடம் கேளுங்கள்",

      patientInformation: "நோயாளி தகவல்",
      patientSubtitle:
        "தொடர்வதற்கு முன் உங்கள் அடிப்படை தகவலை உள்ளிடவும்.",

      fullName: "முழு பெயர்",
      enterFullName: "உங்கள் முழு பெயரை உள்ளிடவும்",

      age: "வயது",
      enterAge: "உங்கள் வயதை உள்ளிடவும்",

      gender: "பாலினம்",
      selectGender: "பாலினத்தைத் தேர்ந்தெடுக்கவும்",

      male: "ஆண்",
      female: "பெண்",
      other: "மற்றவை",

      continue: "தொடரவும்",
      back: "← பின்செல்",

      microphoneInstruction:
        "மைக்ரோஃபோனைத் தட்டி உங்கள் பதிலைப் பேசுங்கள்.",

      listening: "🔴 கேட்கிறது... இப்போது பேசுங்கள்.",

      symptomsTitle: "இன்று நீங்கள் ஏன் இங்கு வந்துள்ளீர்கள்?",
      symptomsSubtitle:
        "உங்கள் அறிகுறி அல்லது வருகைக்கான காரணத்தைத் தேர்ந்தெடுக்கவும்.",

      tellSymptoms: "உங்கள் அறிகுறிகளைச் சொல்லுங்கள்",

      symptomExample:
        'உதாரணம்: "எனக்கு இருமல் மற்றும் காய்ச்சல் உள்ளது"',

      selected: "தேர்ந்தெடுக்கப்பட்டது:",

      review: "உங்கள் தகவலைச் சரிபார்க்கவும்",
      reviewSubtitle:
        "தொடர்வதற்கு முன் உங்கள் தகவலைச் சரிபார்க்கவும்.",

      name: "பெயர்",
      language: "மொழி",
      mode: "முறை",
      symptoms: "அறிகுறிகள்",

      submit: "சமர்ப்பிக்கவும்",

      completed: "சுகாதார பரிசோதனை முடிந்தது",
      completedSubtitle:
        "உங்கள் சுகாதார தகவல் வெற்றிகரமாக சமர்ப்பிக்கப்பட்டது.",

      patient: "நோயாளி",
      status: "நிலை",
      submitted: "சமர்ப்பிக்கப்பட்டது ✓",

      waitMessage:
        "உங்கள் தகவலை சுகாதார நிபுணர் பரிசீலிக்கும் வரை காத்திருக்கவும்.",

      startNew: "புதிய சுகாதார பரிசோதனையைத் தொடங்கவும்",

      footer:
        "உங்கள் தகவல் மருத்துவ பதிவில் சேர்க்கப்படுவதற்கு முன் சுகாதார நிபுணரால் பரிசீலிக்கப்படும்.",

      voiceNotSupported:
        "இந்த உலாவியில் குரல் உள்ளீடு ஆதரிக்கப்படவில்லை. Chrome பயன்படுத்தவும்.",

      voiceError:
        "குரலைக் கண்டறிய முடியவில்லை. மீண்டும் முயற்சிக்கவும்.",

      enterName: "உங்கள் பெயரை உள்ளிடவும்",
      validAge: "சரியான வயதை உள்ளிடவும்",
      selectGenderError: "உங்கள் பாலினத்தைத் தேர்ந்தெடுக்கவும்",
      selectSymptomError: "குறைந்தது ஒரு அறிகுறியைத் தேர்ந்தெடுக்கவும்",
      ageVoiceError: "உங்கள் வயதைத் தெளிவாகச் சொல்லுங்கள்.",
      symptomNotRecognised:
        "அறிகுறி அடையாளம் காணப்படவில்லை. மீண்டும் முயற்சிக்கவும்.",
    },

    "తెలుగు": {
      aiClinical: "AI క్లినికల్ సమాచారం",
      kioskReady: "కియోస్క్ సిద్ధంగా ఉంది",

      welcome: "MediKiosk కు స్వాగతం",
      welcomeSubtitle:
        "మీ సంప్రదింపుకు ముందు కొంత సమాచారాన్ని సేకరిద్దాం.",

      selectLanguage: "మీ భాషను ఎంచుకోండి",

      talk: "మాట్లాడండి",
      talkDescription: "మీ వాయిస్ ఉపయోగించి ప్రశ్నలకు సమాధానం ఇవ్వండి",

      tap: "ట్యాప్ చేయండి",
      tapDescription: "స్క్రీన్‌పై సమాధానాలను ఎంచుకోండి",

      voiceSelected:
        "వాయిస్ మోడ్ ఎంచుకోబడింది. మైక్రోఫోన్ ఉపయోగించి సమాధానం ఇవ్వవచ్చు.",

      startHealthCheck: "హెల్త్ చెక్ ప్రారంభించండి",

      needHelp: "సహాయం కావాలా? ఆసుపత్రి సిబ్బందిని అడగండి",

      patientInformation: "రోగి సమాచారం",
      patientSubtitle:
        "కొనసాగించే ముందు మీ ప్రాథమిక సమాచారాన్ని నమోదు చేయండి.",

      fullName: "పూర్తి పేరు",
      enterFullName: "మీ పూర్తి పేరును నమోదు చేయండి",

      age: "వయస్సు",
      enterAge: "మీ వయస్సును నమోదు చేయండి",

      gender: "లింగం",
      selectGender: "లింగాన్ని ఎంచుకోండి",

      male: "పురుషుడు",
      female: "స్త్రీ",
      other: "ఇతర",

      continue: "కొనసాగించండి",
      back: "← వెనుకకు",

      microphoneInstruction:
        "మైక్రోఫోన్‌ను ట్యాప్ చేసి మీ సమాధానం చెప్పండి.",

      listening: "🔴 వింటోంది... ఇప్పుడు మాట్లాడండి.",

      symptomsTitle: "ఈ రోజు మీరు ఇక్కడికి ఎందుకు వచ్చారు?",
      symptomsSubtitle:
        "మీ లక్షణాలు లేదా సందర్శనకు కారణాన్ని ఎంచుకోండి.",

      tellSymptoms: "మీ లక్షణాలను చెప్పండి",

      symptomExample:
        'ఉదాహరణ: "నాకు దగ్గు మరియు జ్వరం ఉంది"',

      selected: "ఎంచుకున్నవి:",

      review: "మీ సమాచారాన్ని సమీక్షించండి",
      reviewSubtitle:
        "కొనసాగించే ముందు మీ సమాచారాన్ని తనిఖీ చేయండి.",

      name: "పేరు",
      language: "భాష",
      mode: "మోడ్",
      symptoms: "లక్షణాలు",

      submit: "సమర్పించండి",

      completed: "హెల్త్ చెక్ పూర్తయింది",
      completedSubtitle:
        "మీ ఆరోగ్య సమాచారం విజయవంతంగా సమర్పించబడింది.",

      patient: "రోగి",
      status: "స్థితి",
      submitted: "సమర్పించబడింది ✓",

      waitMessage:
        "ఆరోగ్య నిపుణుడు మీ సమాచారాన్ని సమీక్షించే వరకు వేచి ఉండండి.",

      startNew: "కొత్త హెల్త్ చెక్ ప్రారంభించండి",

      footer:
        "మీ సమాచారాన్ని మెడికల్ రికార్డులో చేర్చే ముందు ఆరోగ్య నిపుణుడు సమీక్షిస్తారు.",

      voiceNotSupported:
        "ఈ బ్రౌజర్‌లో వాయిస్ ఇన్‌పుట్‌కు మద్దతు లేదు. Chrome ఉపయోగించండి.",

      voiceError:
        "వాయిస్ గుర్తించబడలేదు. దయచేసి మళ్లీ ప్రయత్నించండి.",

      enterName: "దయచేసి మీ పేరు నమోదు చేయండి",
      validAge: "దయచేసి సరైన వయస్సును నమోదు చేయండి",
      selectGenderError: "దయచేసి మీ లింగాన్ని ఎంచుకోండి",
      selectSymptomError: "దయచేసి కనీసం ఒక లక్షణాన్ని ఎంచుకోండి",
      ageVoiceError: "దయచేసి మీ వయస్సును స్పష్టంగా చెప్పండి.",
      symptomNotRecognised:
        "లక్షణం గుర్తించబడలేదు. మళ్లీ ప్రయత్నించండి.",
    },

    "বাংলা": {
      aiClinical: "AI ক্লিনিক্যাল তথ্য সংগ্রহ",
      kioskReady: "কিয়স্ক প্রস্তুত",

      welcome: "MediKiosk-এ স্বাগতম",
      welcomeSubtitle:
        "পরামর্শের আগে কিছু তথ্য সংগ্রহ করি।",

      selectLanguage: "আপনার ভাষা নির্বাচন করুন",

      talk: "বলুন",
      talkDescription: "আপনার কণ্ঠ ব্যবহার করে প্রশ্নের উত্তর দিন",

      tap: "ট্যাপ করুন",
      tapDescription: "স্ক্রিনে উত্তর নির্বাচন করুন",

      voiceSelected:
        "ভয়েস মোড নির্বাচন করা হয়েছে। আপনি মাইক্রোফোন ব্যবহার করে উত্তর দিতে পারেন।",

      startHealthCheck: "হেলথ চেক শুরু করুন",

      needHelp: "সাহায্য দরকার? হাসপাতালের কর্মীদের জিজ্ঞাসা করুন",

      patientInformation: "রোগীর তথ্য",
      patientSubtitle:
        "চালিয়ে যাওয়ার আগে আপনার মৌলিক তথ্য দিন।",

      fullName: "পুরো নাম",
      enterFullName: "আপনার পুরো নাম লিখুন",

      age: "বয়স",
      enterAge: "আপনার বয়স লিখুন",

      gender: "লিঙ্গ",
      selectGender: "লিঙ্গ নির্বাচন করুন",

      male: "পুরুষ",
      female: "মহিলা",
      other: "অন্যান্য",

      continue: "চালিয়ে যান",
      back: "← ফিরে যান",

      microphoneInstruction:
        "মাইক্রোফোনে ট্যাপ করে আপনার উত্তর বলুন।",

      listening: "🔴 শুনছি... এখন বলুন।",

      symptomsTitle: "আজ আপনি এখানে কেন এসেছেন?",
      symptomsSubtitle:
        "আপনার উপসর্গ বা আসার কারণ নির্বাচন করুন।",

      tellSymptoms: "আপনার উপসর্গ বলুন",

      symptomExample:
        'উদাহরণ: "আমার কাশি এবং জ্বর আছে"',

      selected: "নির্বাচিত:",

      review: "আপনার তথ্য পর্যালোচনা করুন",
      reviewSubtitle:
        "চালিয়ে যাওয়ার আগে আপনার তথ্য পরীক্ষা করুন।",

      name: "নাম",
      language: "ভাষা",
      mode: "মোড",
      symptoms: "উপসর্গ",

      submit: "জমা দিন",

      completed: "হেলথ চেক সম্পন্ন হয়েছে",
      completedSubtitle:
        "আপনার স্বাস্থ্য তথ্য সফলভাবে জমা হয়েছে।",

      patient: "রোগী",
      status: "স্থিতি",
      submitted: "জমা হয়েছে ✓",

      waitMessage:
        "একজন স্বাস্থ্যকর্মী আপনার তথ্য পর্যালোচনা না করা পর্যন্ত অপেক্ষা করুন।",

      startNew: "নতুন হেলথ চেক শুরু করুন",

      footer:
        "আপনার তথ্য মেডিকেল রেকর্ডে যোগ করার আগে একজন স্বাস্থ্যকর্মী তা পর্যালোচনা করবেন।",

      voiceNotSupported:
        "এই ব্রাউজারে ভয়েস ইনপুট সমর্থিত নয়। Chrome ব্যবহার করুন।",

      voiceError:
        "কণ্ঠ শনাক্ত করা যায়নি। আবার চেষ্টা করুন।",

      enterName: "অনুগ্রহ করে আপনার নাম লিখুন",
      validAge: "অনুগ্রহ করে সঠিক বয়স লিখুন",
      selectGenderError: "অনুগ্রহ করে আপনার লিঙ্গ নির্বাচন করুন",
      selectSymptomError: "অনুগ্রহ করে অন্তত একটি উপসর্গ নির্বাচন করুন",
      ageVoiceError: "অনুগ্রহ করে আপনার বয়স পরিষ্কারভাবে বলুন।",
      symptomNotRecognised:
        "উপসর্গ শনাক্ত করা যায়নি। আবার চেষ্টা করুন।",
    },
  };

  const t = translations[language];

  // =========================================================
  // SYMPTOMS
  // =========================================================

  const symptomList = [
    { name: "Fever", icon: "🤒" },
    { name: "Headache", icon: "🤕" },
    { name: "Cough", icon: "😷" },
    { name: "Cold", icon: "🤧" },
    { name: "Nausea", icon: "🤢" },
    { name: "Other", icon: "💊" },
  ];

  const symptomTranslations = {
    English: {
      Fever: "Fever",
      Headache: "Headache",
      Cough: "Cough",
      Cold: "Cold",
      Nausea: "Nausea",
      Other: "Other",
    },

    "हिन्दी": {
      Fever: "बुखार",
      Headache: "सिर दर्द",
      Cough: "खांसी",
      Cold: "जुकाम",
      Nausea: "मतली",
      Other: "अन्य",
    },

    "தமிழ்": {
      Fever: "காய்ச்சல்",
      Headache: "தலைவலி",
      Cough: "இருமல்",
      Cold: "சளி",
      Nausea: "குமட்டல்",
      Other: "மற்றவை",
    },

    "తెలుగు": {
      Fever: "జ్వరం",
      Headache: "తలనొప్పి",
      Cough: "దగ్గు",
      Cold: "జలుబు",
      Nausea: "వికారం",
      Other: "ఇతర",
    },

    "বাংলা": {
      Fever: "জ্বর",
      Headache: "মাথাব্যথা",
      Cough: "কাশি",
      Cold: "সর্দি",
      Nausea: "বমি বমি ভাব",
      Other: "অন্যান্য",
    },
  };

  const symptomText = (name) =>
    symptomTranslations[language][name];

  // =========================================================
  // VOICE LANGUAGE
  // =========================================================

  const getSpeechLanguage = () => {
    if (language === "हिन्दी") return "hi-IN";
    if (language === "தமிழ்") return "ta-IN";
    if (language === "తెలుగు") return "te-IN";
    if (language === "বাংলা") return "bn-IN";

    return "en-IN";
  };

  // =========================================================
  // VOICE INPUT
  // =========================================================

  const startVoiceInput = (field) => {
    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert(t.voiceNotSupported);
      return;
    }

    const recognition = new SpeechRecognition();

    recognition.lang = getSpeechLanguage();
    recognition.continuous = false;
    recognition.interimResults = false;

    setListening(true);

    recognition.start();

    recognition.onresult = (event) => {
      const text =
        event.results[0][0].transcript.trim();

      if (field === "name") {
        setPatient((current) => ({
          ...current,
          name: text,
        }));
      }

      if (field === "age") {
        const numbers = text.match(/\d+/);

        if (numbers) {
          setPatient((current) => ({
            ...current,
            age: numbers[0],
          }));
        } else {
          alert(t.ageVoiceError);
        }
      }

      if (field === "gender") {
        const lowerText = text.toLowerCase();

        if (
          lowerText.includes("male") ||
          lowerText.includes("man") ||
          text.includes("पुरुष") ||
          text.includes("ஆண்") ||
          text.includes("పురుష") ||
          text.includes("পুরুষ")
        ) {
          setPatient((current) => ({
            ...current,
            gender: "Male",
          }));
        } else if (
          lowerText.includes("female") ||
          lowerText.includes("woman") ||
          text.includes("महिला") ||
          text.includes("பெண்") ||
          text.includes("స్త్రీ") ||
          text.includes("মহিলা")
        ) {
          setPatient((current) => ({
            ...current,
            gender: "Female",
          }));
        } else {
          setPatient((current) => ({
            ...current,
            gender: "Other",
          }));
        }
      }
    };

    recognition.onerror = () => {
      setListening(false);
      alert(t.voiceError);
    };

    recognition.onend = () => {
      setListening(false);
    };
  };

  // =========================================================
  // VOICE SYMPTOMS
  // =========================================================

  const startSymptomVoice = () => {
    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert(t.voiceNotSupported);
      return;
    }

    const recognition = new SpeechRecognition();

    recognition.lang = getSpeechLanguage();
    recognition.continuous = false;
    recognition.interimResults = false;

    setListening(true);

    recognition.start();

    recognition.onresult = (event) => {
      const text =
        event.results[0][0].transcript.toLowerCase();

      const foundSymptoms = [];

      // English
      if (text.includes("fever")) foundSymptoms.push("Fever");
      if (text.includes("headache")) foundSymptoms.push("Headache");
      if (text.includes("cough")) foundSymptoms.push("Cough");
      if (text.includes("cold")) foundSymptoms.push("Cold");
      if (text.includes("nausea")) foundSymptoms.push("Nausea");
      if (text.includes("other")) foundSymptoms.push("Other");

      // Hindi
      if (text.includes("बुखार")) foundSymptoms.push("Fever");
      if (text.includes("सिर दर्द")) foundSymptoms.push("Headache");
      if (text.includes("खांसी")) foundSymptoms.push("Cough");
      if (text.includes("जुकाम")) foundSymptoms.push("Cold");
      if (text.includes("मतली")) foundSymptoms.push("Nausea");
      if (text.includes("अन्य")) foundSymptoms.push("Other");

      // Tamil
      if (text.includes("காய்ச்சல்")) foundSymptoms.push("Fever");
      if (text.includes("தலைவலி")) foundSymptoms.push("Headache");
      if (text.includes("இருமல்")) foundSymptoms.push("Cough");
      if (text.includes("சளி")) foundSymptoms.push("Cold");
      if (text.includes("குமட்டல்")) foundSymptoms.push("Nausea");

      // Telugu
      if (text.includes("జ్వరం")) foundSymptoms.push("Fever");
      if (text.includes("తలనొప్పి")) foundSymptoms.push("Headache");
      if (text.includes("దగ్గు")) foundSymptoms.push("Cough");
      if (text.includes("జలుబు")) foundSymptoms.push("Cold");
      if (text.includes("వికారం")) foundSymptoms.push("Nausea");

      // Bengali
      if (text.includes("জ্বর")) foundSymptoms.push("Fever");
      if (text.includes("মাথাব্যথা")) foundSymptoms.push("Headache");
      if (text.includes("কাশি")) foundSymptoms.push("Cough");
      if (text.includes("সর্দি")) foundSymptoms.push("Cold");

      if (foundSymptoms.length > 0) {
        setSymptoms((current) => [
          ...new Set([...current, ...foundSymptoms]),
        ]);
      } else {
        alert(t.symptomNotRecognised);
      }
    };

    recognition.onerror = () => {
      setListening(false);
      alert(t.voiceError);
    };

    recognition.onend = () => {
      setListening(false);
    };
  };

  // =========================================================
  // PATIENT DETAILS
  // =========================================================

  const handlePatientChange = (field, value) => {
    setPatient((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handlePatientContinue = () => {
    if (!patient.name.trim()) {
      alert(t.enterName);
      return;
    }

    if (
      !patient.age ||
      patient.age < 1 ||
      patient.age > 120
    ) {
      alert(t.validAge);
      return;
    }

    if (!patient.gender) {
      alert(t.selectGenderError);
      return;
    }

    setStep(3);
  };

  // =========================================================
  // SYMPTOMS
  // =========================================================

  const toggleSymptom = (symptom) => {
    setSymptoms((current) =>
      current.includes(symptom)
        ? current.filter((item) => item !== symptom)
        : [...current, symptom]
    );
  };

  const handleSymptomsContinue = () => {
    if (symptoms.length === 0) {
      alert(t.selectSymptomError);
      return;
    }

    setStep(4);
  };

  // =========================================================
  // NEW HEALTH CHECK
  // =========================================================

  const handleNewHealthCheck = () => {
    setStep(1);
    setLanguage("English");
    setInteractionMode("Tap");

    setPatient({
      name: "",
      age: "",
      gender: "",
    });

    setSymptoms([]);
    setSubmitted(false);
  };

  // =========================================================
  // HEADER
  // =========================================================

  const Header = () => (
    <header className="header">
      <div className="logo">
        <div className="logo-icon">M</div>

        <div>
          <h1>MediKiosk</h1>
          <p>{t.aiClinical}</p>
        </div>
      </div>

      <div className="header-right">
        <span className="status-dot"></span>
        {t.kioskReady}
      </div>
    </header>
  );

  // =========================================================
  // FOOTER
  // =========================================================

  const Footer = () => (
    <footer>
      <p>{t.footer}</p>
    </footer>
  );

  // =========================================================
  // SUCCESS SCREEN
  // =========================================================

  if (submitted) {
    return (
      <div className="app">
        <Header />

        <main className="main">
          <section className="welcome-card">

            <div className="welcome-icon">✅</div>

            <h2>{t.completed}</h2>

            <p className="subtitle">
              {t.completedSubtitle}
            </p>

            <div className="review-section">

              <p>
                <strong>{t.patient}:</strong>{" "}
                {patient.name}
              </p>

              <p>
                <strong>{t.status}:</strong>{" "}
                {t.submitted}
              </p>

              <p>{t.waitMessage}</p>

            </div>

            <button
              className="start-btn"
              onClick={handleNewHealthCheck}
            >
              {t.startNew}
              <span>→</span>
            </button>

          </section>
        </main>

        <Footer />
      </div>
    );
  }

  // =========================================================
  // STEP 1 — WELCOME
  // =========================================================

  if (step === 1) {
    return (
      <div className="app">
        <Header />

        <main className="main">
          <section className="welcome-card">

            <div className="welcome-icon">👋</div>

            <h2>{t.welcome}</h2>

            <p className="subtitle">
              {t.welcomeSubtitle}
            </p>

            {/* LANGUAGE */}

            <div className="language-section">

              <h3>{t.selectLanguage}</h3>

              <div className="language-grid">

                {languages.map((lang) => (
                  <button
                    key={lang}
                    className={`language-btn ${
                      language === lang
                        ? "selected"
                        : ""
                    }`}
                    onClick={() =>
                      setLanguage(lang)
                    }
                  >
                    {lang}
                  </button>
                ))}

              </div>

            </div>

            {/* TALK / TAP */}

            <div className="options">

              <button
                type="button"
                className={`option-card ${
                  interactionMode === "Talk"
                    ? "selected"
                    : ""
                }`}
                onClick={() =>
                  setInteractionMode("Talk")
                }
              >
                <div className="option-icon">
                  🎙️
                </div>

                <div>
                  <h3>{t.talk}</h3>
                  <p>{t.talkDescription}</p>
                </div>
              </button>

              <button
                type="button"
                className={`option-card ${
                  interactionMode === "Tap"
                    ? "selected"
                    : ""
                }`}
                onClick={() =>
                  setInteractionMode("Tap")
                }
              >
                <div className="option-icon">
                  👆
                </div>

                <div>
                  <h3>{t.tap}</h3>
                  <p>{t.tapDescription}</p>
                </div>
              </button>

            </div>

            {interactionMode === "Talk" && (
              <p
                style={{
                  textAlign: "center",
                  marginTop: "10px",
                  fontSize: "14px",
                }}
              >
                🎙️ {t.voiceSelected}
              </p>
            )}

            <button
              className="start-btn"
              onClick={() => setStep(2)}
            >
              {t.startHealthCheck}
              <span>→</span>
            </button>

            <button className="help-btn">
              {t.needHelp}
            </button>

          </section>
        </main>

        <Footer />
      </div>
    );
  }

  // =========================================================
  // STEP 2 — PATIENT INFORMATION
  // =========================================================

  if (step === 2) {
    return (
      <div className="app">
        <Header />

        <main className="main">
          <section className="welcome-card">

            <h2>{t.patientInformation}</h2>

            <p className="subtitle">
              {t.patientSubtitle}
            </p>

            <div className="form-section">

              {/* NAME */}

              <label>{t.fullName}</label>

              <div
                style={{
                  display: "flex",
                  gap: "8px",
                }}
              >

                <input
                  type="text"
                  placeholder={t.enterFullName}
                  value={patient.name}
                  onChange={(e) =>
                    handlePatientChange(
                      "name",
                      e.target.value
                    )
                  }
                  style={{ flex: 1 }}
                />

                {interactionMode === "Talk" && (
                  <button
                    type="button"
                    onClick={() =>
                      startVoiceInput("name")
                    }
                    style={{
                      minWidth: "55px",
                      border: "none",
                      borderRadius: "10px",
                      cursor: "pointer",
                      fontSize: "22px",
                    }}
                    title={t.fullName}
                  >
                    🎙️
                  </button>
                )}

              </div>

              {/* AGE */}

              <label>{t.age}</label>

              <div
                style={{
                  display: "flex",
                  gap: "8px",
                }}
              >

                <input
                  type="number"
                  placeholder={t.enterAge}
                  value={patient.age}
                  onChange={(e) =>
                    handlePatientChange(
                      "age",
                      e.target.value
                    )
                  }
                  style={{ flex: 1 }}
                />

                {interactionMode === "Talk" && (
                  <button
                    type="button"
                    onClick={() =>
                      startVoiceInput("age")
                    }
                    style={{
                      minWidth: "55px",
                      border: "none",
                      borderRadius: "10px",
                      cursor: "pointer",
                      fontSize: "22px",
                    }}
                    title={t.age}
                  >
                    🎙️
                  </button>
                )}

              </div>

              {/* GENDER */}

              <label>{t.gender}</label>

              <div
                style={{
                  display: "flex",
                  gap: "8px",
                }}
              >

                <select
                  value={patient.gender}
                  onChange={(e) =>
                    handlePatientChange(
                      "gender",
                      e.target.value
                    )
                  }
                  style={{ flex: 1 }}
                >
                  <option value="">
                    {t.selectGender}
                  </option>

                  <option value="Male">
                    {t.male}
                  </option>

                  <option value="Female">
                    {t.female}
                  </option>

                  <option value="Other">
                    {t.other}
                  </option>
                </select>

                {interactionMode === "Talk" && (
                  <button
                    type="button"
                    onClick={() =>
                      startVoiceInput("gender")
                    }
                    style={{
                      minWidth: "55px",
                      border: "none",
                      borderRadius: "10px",
                      cursor: "pointer",
                      fontSize: "22px",
                    }}
                    title={t.gender}
                  >
                    🎙️
                  </button>
                )}

              </div>

            </div>

            {interactionMode === "Talk" && (
              <p
                style={{
                  textAlign: "center",
                  marginTop: "15px",
                }}
              >
                {listening
                  ? t.listening
                  : `🎙️ ${t.microphoneInstruction}`}
              </p>
            )}

            <button
              className="start-btn"
              onClick={handlePatientContinue}
            >
              {t.continue}
              <span>→</span>
            </button>

            <button
              className="help-btn"
              onClick={() => setStep(1)}
            >
              {t.back}
            </button>

          </section>
        </main>

        <Footer />
      </div>
    );
  }

  // =========================================================
  // STEP 3 — SYMPTOMS
  // =========================================================

  if (step === 3) {
    return (
      <div className="app">
        <Header />

        <main className="main">
          <section className="welcome-card">

            <h2>{t.symptomsTitle}</h2>

            <p className="subtitle">
              {t.symptomsSubtitle}
            </p>

            {/* VOICE */}

            {interactionMode === "Talk" && (
              <div
                style={{
                  textAlign: "center",
                  marginBottom: "20px",
                }}
              >

                <button
                  type="button"
                  onClick={startSymptomVoice}
                  style={{
                    padding: "15px 25px",
                    borderRadius: "12px",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "18px",
                  }}
                >
                  🎙️{" "}
                  {listening
                    ? t.listening
                    : t.tellSymptoms}
                </button>

                <p style={{ fontSize: "14px" }}>
                  {t.symptomExample}
                </p>

              </div>
            )}

            {/* SYMPTOMS */}

            <div className="symptoms-grid">

              {symptomList.map((symptom) => (
                <button
                  key={symptom.name}
                  className={`symptom-btn ${
                    symptoms.includes(symptom.name)
                      ? "selected"
                      : ""
                  }`}
                  onClick={() =>
                    toggleSymptom(symptom.name)
                  }
                >
                  {symptom.icon}{" "}
                  {symptomText(symptom.name)}
                </button>
              ))}

            </div>

            {/* SELECTED */}

            {symptoms.length > 0 && (
              <p
                style={{
                  textAlign: "center",
                  marginTop: "15px",
                }}
              >
                <strong>{t.selected}</strong>{" "}
                {symptoms
                  .map((item) => symptomText(item))
                  .join(", ")}
              </p>
            )}

            <button
              className="start-btn"
              onClick={handleSymptomsContinue}
            >
              {t.continue}
              <span>→</span>
            </button>

            <button
              className="help-btn"
              onClick={() => setStep(2)}
            >
              {t.back}
            </button>

          </section>
        </main>

        <Footer />
      </div>
    );
  }

  // =========================================================
  // STEP 4 — REVIEW
  // =========================================================

  return (
    <div className="app">
      <Header />

      <main className="main">
        <section className="welcome-card">

          <div className="welcome-icon">✅</div>

          <h2>{t.review}</h2>

          <p className="subtitle">
            {t.reviewSubtitle}
          </p>

          <div className="review-section">

            <p>
              <strong>{t.name}:</strong>{" "}
              {patient.name}
            </p>

            <p>
              <strong>{t.age}:</strong>{" "}
              {patient.age}
            </p>

            <p>
              <strong>{t.gender}:</strong>{" "}
              {patient.gender === "Male"
                ? t.male
                : patient.gender === "Female"
                ? t.female
                : t.other}
            </p>

            <p>
              <strong>{t.language}:</strong>{" "}
              {language}
            </p>

            <p>
              <strong>{t.mode}:</strong>{" "}
              {interactionMode}
            </p>

            <p>
              <strong>{t.symptoms}:</strong>{" "}
              {symptoms
                .map((item) => symptomText(item))
                .join(", ")}
            </p>

          </div>

          {/* SUBMIT */}

          <button
            className="start-btn"
            onClick={() => setSubmitted(true)}
          >
            {t.submit}
            <span>✓</span>
          </button>

          <button
            className="help-btn"
            onClick={() => setStep(3)}
          >
            {t.back}
          </button>

        </section>
      </main>

      <Footer />
    </div>
  );
}

export default App;