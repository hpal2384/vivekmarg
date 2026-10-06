import express from 'express'
import { readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { composeVideo, reelOutputDirectory } from './composer.js'
import { getVeoVideoJob, isVeoConfigured, startVeoVideoJob } from './videoProvider.js'
import {
  completeYouTubeAuthorization,
  createYouTubeAuthorizationUrl,
  disconnectYouTube,
  getYouTubeAnalytics,
  getYouTubeStatus,
  isYouTubeConfigured,
  listYouTubePosts,
  uploadYouTubeShort,
} from './youtube.js'
import { getReelRecord, listReelRecords } from './reelStore.js'
import { listLibraryMomentIds, saveLibraryMomentIds } from './libraryStore.js'

const app = express()
const port = Number(process.env.PORT ?? 8787)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const teachingRecords = JSON.parse(await readFile(path.join(root, 'src/data/teachings.json'), 'utf8'))
const templates = new Set(['Storytelling', 'Quote focused', 'Question'])
const languages = new Set(['English', 'Hindi', 'Punjabi', 'Kannada'])
app.use(express.json({ limit: '32kb' }))
app.use('/media', express.static(reelOutputDirectory, { fallthrough: false, maxAge: '1h' }))

const fallbackThemes = {
  'fearlessness-001': {
    English: { title: 'Fearlessness: take the step', hook: 'What could you try if fear stopped choosing for you?', context: 'Fear can make a first step feel impossible, even when the path is already there.', interpretation: 'This teaching on fearlessness can be applied by noticing fear without letting it make the decision.', takeaway: 'Courage starts with one honest next step.', closing: 'Take the step. Let the rest follow.' },
    Hindi: { title: 'निडरता: कदम उठाइए', hook: 'अगर डर आपके लिए चुनाव न करे, तो आप क्या प्रयास करेंगे?', context: 'भय पहला कदम बहुत कठिन बना सकता है, भले ही रास्ता पहले से ही मौजूद हो।', interpretation: 'यह शिक्षण हमें यह समझने में मदद करता है कि भय को पहचानें और उसे निर्णय बनाने न दें।', takeaway: 'साहस एक सच्चे अगले कदम से शुरू होता है।', closing: 'कदम उठाइए। बाकी रास्ता खुद बन जाएगा।' },
    Punjabi: { title: 'ਡਰ ਤੋਂ ਬਿਨਾਂ: ਕਦਮ ਬੁਲਾਓ', hook: 'ਜੇਕਰ ਡਰ ਤੁਹਾਡੀ ਚੋਣ ਨਾ ਕਰਦਾ, ਤਾਂ ਤੁਸੀਂ ਕੀ ਕਰਨਾ ਚਾਹੁੰਦੇ ਹੋ?', context: 'ਡਰ ਪਹਿਲਾ ਕਦਮ ਮੁਸ਼ਕਲ ਬਣਾ ਸਕਦਾ ਹੈ, ਭਾਵੇਂ ਰਸਤਾ ਪਹਿਲਾਂ ਹੀ ਹੋਵੇ।', interpretation: 'ਇਹ ਸਿੱਖਿਆ ਸਾਨੂੰ ਸਿਖਾਉਂਦੀ ਹੈ ਕਿ ਡਰ ਨੂੰ ਵੇਖਿਆ ਜਾ ਸਕਦਾ ਹੈ, ਬਿਨਾਂ ਇਸਦੇ ਕਿ ਉਹ ਫੈਸਲਾ ਲੈ ਲਵੇ।', takeaway: 'ਹਿੰਮਤ ਇੱਕ ਸਹੀ ਅਗਲੇ ਕਦਮ ਨਾਲ ਸ਼ੁਰੂ ਹੁੰਦਾ ਹੈ।', closing: 'ਕਦਮ ਚਲਾਓ। ਬਾਕੀ ਰਸਤਾ ਖੁੱਲ ਜਾਵੇਗਾ।' },
    Kannada: { title: 'ನಿರ್ಭಯತೆ: ಹೆಜ್ಜೆ ಇಡಿ', hook: 'ಭಯ ನಿಮ್ಮ ಆಯ್ಕೆ ಮಾಡದಿದ್ದರೆ, ನೀವು ಏನು ಪ್ರಯತ್ನಿಸುತ್ತೀರಿ?', context: 'ದಾರಿ ಇದ್ದರೂ, ಭಯ ಮೊದಲ ಹೆಜ್ಜೆಯನ್ನು ಕಷ್ಟವಾಗಿಸಬಹುದು.', interpretation: 'ಭಯವನ್ನು ಗಮನಿಸಿ, ಆದರೆ ನಿರ್ಧಾರವನ್ನು ಅದಕ್ಕೆ ಬಿಡಬಾರದು ಎಂಬುದನ್ನು ಈ ಬೋಧನೆ ತಿಳಿಸುತ್ತದೆ.', takeaway: 'ಧೈರ್ಯ ಒಂದು ಸಣ್ಣ ಹೆಜ್ಜೆಯಿಂದ ಆರಂಭವಾಗುತ್ತದೆ.', closing: 'ಹೆಜ್ಜೆ ಇಡಿ. ಮುಂದಿನ ದಾರಿ ತೆರೆದುಕೊಳ್ಳುತ್ತದೆ.' },
  },
  'self-confidence-001': {
    English: { title: 'Self-confidence: see your strength', hook: 'What changes when you stop underestimating yourself?', context: 'A doubt repeated often can begin to sound like a fact, even when it is not.', interpretation: 'This teaching on self-confidence asks us to question the belief that we are incapable.', takeaway: 'Let your next attempt challenge your self-doubt.', closing: 'Give your own capacity a chance.' },
    Hindi: { title: 'आत्मविश्वास: अपनी शक्ति देखिए', hook: 'जब आप अपने आप को कम आँकना बंद करते हैं, तो क्या बदलता है?', context: 'बार-बार दोहराया गया संदेह सत्य जैसा लग सकता है, भले ही वह सत्य न हो।', interpretation: 'यह शिक्षण हमें यह सवाल करने के लिए प्रेरित करता है कि क्या हम सचमुच अक्षम हैं।', takeaway: 'अगला प्रयास आपके आत्म-संदेह को चुनौती दे।', closing: 'अपनी क्षमता को एक अवसर दीजिए।' },
    Punjabi: { title: 'ਆਤਮ-ਨਿਸ਼ਚੇਤ: ਆਪਣੀ ਸ਼ਕਤੀ ਵੇਖੋ', hook: 'ਜਦੋਂ ਤੁਸੀਂ ਆਪਣੇ ਆਪ ਨੂੰ ਘੱਟ ਅੰਦਾਜ਼ ਕਰਨਾ ਬੰਦ ਕਰ ਦਿੰਦੇ ਹੋ, ਤਾਂ ਕੀ ਬਦਲਦਾ ਹੈ?', context: 'ਕਈ ਵਾਰ ਦੁਹਰਾਇਆ ਗਿਆ ਸੰਦਰਸ਼ ਵੀ ਸੱਚ ਜਿਹਾ ਲੱਗ ਸਕਦਾ ਹੈ, ਭਾਵੇਂ ਉਹ ਸੱਚ ਨਾ ਹੋਵੇ।', interpretation: 'ਇਹ ਸਿੱਖਿਆ ਸਾਨੂੰ ਇਹ ਪੁੱਛਣ ਲਈ ਪ੍ਰੇਰਿਤ ਕਰਦੀ ਹੈ ਕਿ ਕੀ ਅਸੀਂ ਅਸਮਰੱਥ ਹਾਂ।', takeaway: 'ਅਗਲਾ ਪ੍ਰਯਾਸ ਤੁਹਾਡੇ ਅੰਦਰ ਸੰਦੇਹ ਨੂੰ ਚੁਣੌਤੀ ਦਵੇਗਾ।', closing: 'ਆਪਣੀ ਸਮਰੱਥਾ ਨੂੰ ਇੱਕ ਮੌਕਾ ਦਿਓ।' },
    Kannada: { title: 'ಆತ್ಮವಿಶ್ವಾಸ: ನಿಮ್ಮ ಶಕ್ತಿಯನ್ನು ಅರಿಯಿರಿ', hook: 'ನಿಮ್ಮನ್ನು ಕಡಿಮೆ ಅಂದಾಜಿಸುವುದನ್ನು ನಿಲ್ಲಿಸಿದರೆ ಏನು ಬದಲಾಗುತ್ತದೆ?', context: 'ಪದೇಪದೇ ಕೇಳುವ ಸಂಶಯ ಸತ್ಯದಂತೆ ತೋರಬಹುದು, ಆದರೆ ಅದು ಸತ್ಯವಾಗಿರಬೇಕಿಲ್ಲ.', interpretation: 'ನಾವು ಅಸಮರ್ಥರು ಎಂಬ ನಂಬಿಕೆಯನ್ನು ಪ್ರಶ್ನಿಸಲು ಈ ಬೋಧನೆ ಪ್ರೇರೇಪಿಸುತ್ತದೆ.', takeaway: 'ನಿಮ್ಮ ಮುಂದಿನ ಪ್ರಯತ್ನವೇ ಸಂಶಯಕ್ಕೆ ಉತ್ತರವಾಗಲಿ.', closing: 'ನಿಮ್ಮ ಸಾಮರ್ಥ್ಯಕ್ಕೆ ಒಂದು ಅವಕಾಶ ನೀಡಿ.' },
  },
  'concentration-001': {
    English: { title: 'Concentration: one thing at a time', hook: 'Where would your attention go if you chose it on purpose?', context: 'A little attention scattered everywhere leaves less energy for what matters now.', interpretation: 'This teaching on concentration points to focused attention as a way to deepen learning.', takeaway: 'Give one important task your undivided attention.', closing: 'Return to what matters.' },
    Hindi: { title: 'एकाग्रता: एक समय में एक चीज', hook: 'अगर आप अपनी जागरूकता का सही चुनाव करें, तो वह कहाँ जाएगी?', context: 'हर जगह बिखरी हुई छोटी-सी ध्यानशक्ति अभी के महत्वपूर्ण काम के लिए कम ऊर्जा छोड़ती है।', interpretation: 'यह शिक्षण एकाग्रता को सीखने की गहराई के लिए आवश्यक मानता है।', takeaway: 'एक महत्वपूर्ण काम को पूरी एकाग्रता दें।', closing: 'जो चीज महत्वपूर्ण है, उस पर लौटिए।' },
    Punjabi: { title: 'ਕੇਂਦਰੀਕਰਨ: ਇੱਕ ਸਮੇਂ ਵਿੱਚ ਇੱਕ ਚੀਜ਼', hook: 'ਜੇ ਤੁਸੀਂ ਆਪਣੀ ਧਿਆਨ ਨੂੰ ਜਾਣ ਬੁੱਝ ਕੇ ਚੁਣੋ, ਤਾਂ ਉਹ ਕਿੱਥੇ ਜਾਵੇਗਾ?', context: 'ਹਰ ਥਾਂ ਬੇਤਰਤੀਬੇ ਧਿਆਨ ਦਾ ਥੋੜਾ-ਥੋੜਾ ਟੁਕੜਾ ਹੁਣ ਦੀ ਮਹੱਤਵਪੂਰਨ ਚੀਜ਼ ਲਈ ਘੱਟ_energy ਛੱਡਦਾ ਹੈ।', interpretation: 'ਇਹ ਸਿੱਖਿਆ ਕੇਂਦਰੀਕਰਨ ਨੂੰ ਸਿੱਖਿਆ ਦੀ ਉਤਸ਼ਾਹ ਦੇ ਤਰੀਕੇ ਵਜੋਂ ਦਰਸਾਉਂਦੀ ਹੈ।', takeaway: 'ਇੱਕ ਮਹੱਤਵਪੂਰਨ ਕੰਮ ਨੂੰ ਆਪਣੀ ਪੂਰੀ ਧਿਆਨ ਲਿਖਤ ਦਿਓ।', closing: 'ਜਿਸ ਚੀਜ਼ ਦਾ ਅਰਥ ਹੈ, ਉਸ ’ਤੇ ਵਾਪਸ ਜਾਓ।' },
    Kannada: { title: 'ಏಕಾಗ್ರತೆ: ಒಂದೇ ಸಮಯದಲ್ಲಿ ಒಂದು ಕೆಲಸ', hook: 'ನಿಮ್ಮ ಗಮನವನ್ನು ನೀವು ಆರಿಸಿದರೆ, ಅದು ಎಲ್ಲಿಗೆ ಹೋಗುತ್ತದೆ?', context: 'ಎಲ್ಲೆಡೆ ಹಂಚಿದ ಸ್ವಲ್ಪ ಗಮನ, ಮುಖ್ಯ ಕೆಲಸಕ್ಕೆ ಕಡಿಮೆ ಶಕ್ತಿಯನ್ನು ಬಿಡುತ್ತದೆ.', interpretation: 'ಕಲಿಕೆಯನ್ನು ಆಳಗೊಳಿಸಲು ಏಕಾಗ್ರ ಗಮನ ಅಗತ್ಯವೆಂದು ಈ ಬೋಧನೆ ಹೇಳುತ್ತದೆ.', takeaway: 'ಒಂದು ಮುಖ್ಯ ಕೆಲಸಕ್ಕೆ ಸಂಪೂರ್ಣ ಗಮನ ನೀಡಿ.', closing: 'ಮುಖ್ಯವಾದುದಕ್ಕೆ ಮರಳಿ.' },
  },
  'education-001': {
    English: { title: 'Education: awaken what is within', hook: 'What if learning helped you discover what you can become?', context: 'Education is more than collecting facts; it can help us uncover and develop our capacities.', interpretation: 'This teaching frames education as drawing out human potential, not simply adding information.', takeaway: 'Learn something that helps you grow from within.', closing: 'Keep becoming.' },
    Hindi: { title: 'शिक्षा: भीतर का जागरण', hook: 'अगर सीखने से आप जान पाएँ कि आप क्या बन सकते हैं, तो क्या होगा?', context: 'शिक्षा तथ्य इकट्ठे करने से अधिक है; यह हमारे भीतर की क्षमता को पहचानने और विकसित करने में मदद करती है।', interpretation: 'यह शिक्षण शिक्षा को सूचनाओं का संचय नहीं, बल्कि मानव क्षमता का विकास मानता है।', takeaway: 'ऐसी कुछ भी सीखें जो आपको भीतर से बढ़ने में मदद करे।', closing: 'बनते रहिए।' },
    Punjabi: { title: 'ਸਿੱਖਿਆ: ਅੰਦਰ ਦੀ ਜਗ੍ਹਾ', hook: 'ਜੇਕਰ ਸਿੱਖਿਆ ਤੁਹਾਨੂੰ ਇਹ ਪਤਾ ਲਗਾਉਣ ਵਿੱਚ ਮਦਦ ਕਰੇ ਕਿ ਤੁਸੀਂ ਕੀ ਬਣ ਸਕਦੇ ਹੋ, ਤਾਂ ਕੀ ਹੋਵੇਗਾ?', context: 'ਸਿੱਖਿਆ ਸਿਰਫ਼ ਤੱਥ ਇਕੱਠੇ ਕਰਨ ਨਾਲ ਵਧੀ ਨਹੀਂ; ਇਹ ਸਾਡੇ ਅੰਦਰ ਦੀ ਸਮਰੱਥਾ ਨੂੰ ਖੋਲ੍ਹਣ ਵਿੱਚ ਮਦਦ ਕਰਦੀ ਹੈ।', interpretation: 'ਇਹ ਸਿੱਖਿਆ ਸਿੱਖਿਆ ਨੂੰ ਸਿਰਫ਼ ਜਾਨਕਾਰੀ ਦੇਣ ਨਾਲੋਂ ਵੱਧ ਕੇ ਮਨੁੱਖੀ ਸਮਰੱਥਾ ਦਾ ਵਿਕਾਸ ਮੰਨਦੀ ਹੈ।', takeaway: 'ऐਸੀ ਕੁਝ ਸਿੱਖੋ ਜੋ ਤੁਹਾਨੂੰ ਅੰਦਰੋਂ ਵਧਣ ਵਿੱਚ ਮਦਦ ਕਰੇ।', closing: 'ਬਦਲਦੇ ਰਹੋ।' },
    Kannada: { title: 'ಶಿಕ್ಷಣ: ಒಳಗಿನ ಸಾಮರ್ಥ್ಯವನ್ನು ಅರಿಯಿರಿ', hook: 'ಕಲಿಕೆ ನೀವು ಏನಾಗಬಹುದು ಎಂಬುದನ್ನು ತೋರಿಸಿದರೆ?', context: 'ಶಿಕ್ಷಣವು ಮಾಹಿತಿ ಸಂಗ್ರಹಿಸುವುದಷ್ಟೇ ಅಲ್ಲ; ನಮ್ಮ ಸಾಮರ್ಥ್ಯವನ್ನು ಅರಳಿಸಬಹುದು.', interpretation: 'ಶಿಕ್ಷಣವು ಕೇವಲ ಮಾಹಿತಿ ಸೇರಿಸುವುದಲ್ಲ, ಮಾನವ ಸಾಮರ್ಥ್ಯವನ್ನು ಹೊರತರುವುದು ಎಂದು ಈ ಬೋಧನೆ ಹೇಳುತ್ತದೆ.', takeaway: 'ನಿಮ್ಮೊಳಗಿನ ಬೆಳವಣಿಗೆಗೆ ನೆರವಾಗುವಂತೆ ಕಲಿಯಿರಿ.', closing: 'ಬೆಳೆಯುತ್ತಿರಿ.' },
  },
  'character-001': {
    English: { title: 'Character: become through your choices', hook: 'What are your everyday thoughts helping you become?', context: 'Small thoughts and choices can quietly shape the habits we carry into tomorrow.', interpretation: 'This teaching on character invites us to choose thoughts and actions that reflect our values.', takeaway: 'Choose one thought worth practicing today.', closing: 'Practice what you hope to become.' },
    Hindi: { title: 'चरित्र: अपने चुनावों से बनिए', hook: 'आपकी रोज़मर्रा की सोच आपको क्या बनाने में मदद कर रही है?', context: 'छोटी-छोटी सोचें और चुनाव हमारे कल के संस्कारों को धीरे-धीरे आकार देते हैं।', interpretation: 'यह शिक्षण हमें ऐसे विचार और कार्य चुनने के लिए प्रेरित करता है जो हमारे मूल्यों को दर्शाएँ।', takeaway: 'आज एक ऐसा विचार चुनें जिसे आप अभ्यास में लाएँ।', closing: 'उस चीज़ का अभ्यास कीजिए जिसे आप बनना चाहते हैं।' },
    Punjabi: { title: 'ਚਰਿਤ: ਆਪਣੀਆਂ ਚੋਣਾਂ ਨਾਲ ਬਣੋ', hook: 'ਤੁਹਾਡੀਆਂ ਰੋਜ਼ਾਨਾ ਸੋਚਾਂ ਤੁਹਾਨੂੰ ਕੀ ਬਣਾ ਰਹੀਆਂ ਹਨ?', context: 'ਢੁੱਕੀਆਂ ਸੋਚਾਂ ਅਤੇ ਚੋਣਾਂ ਅੱਜ ਦੇ ਬਾਅਦ ਦੇ ਅਭਿਆਸਾਂ ਨੂੰ ਸੌਮ-ਸੌਮ ਕਰਕੇ ਬਣਾ ਦਿੰਦੀਆਂ ਹਨ।', interpretation: 'ਇਹ ਸਿੱਖਿਆ ਸਾਨੂੰ ਅਜਿਹੀਆਂ ਚੋਣਾਂ ਅਤੇ ਕਾਰਵਾਈਆਂ ਚੁਣਣ ਲਈ ਪ੍ਰੇਰਿਤ ਕਰਦੀ ਹੈ ਜੋ ਸਾਡੇ ਮੁੱਲਾਂ ਨੂੰ ਦਰਸਾਉਣ।', takeaway: 'ਅੱਜ ਇੱਕ ਅਜਿਹੀ ਸੋਚ ਚੁਣੋ ਜਿਸਦਾ ਅਭਿਆਸ ਤੁਸੀਂ ਕਰ ਸਕੋ।', closing: 'ਉਸ ਚੀਜ਼ ਦਾ ਅਭਿਆਸ ਕਰੋ ਜਿਸ ਨੂੰ ਤੁਸੀਂ ਬਣਾਨਾ ਚਾਹੁੰਦੇ ਹੋ।' },
    Kannada: { title: 'ಶೀಲ: ನಿಮ್ಮ ಆಯ್ಕೆಗಳಿಂದ ರೂಪುಗೊಳ್ಳಿ', hook: 'ನಿಮ್ಮ ದಿನನಿತ್ಯದ ಆಲೋಚನೆಗಳು ನಿಮ್ಮನ್ನು ಏನಾಗಿಸುತ್ತಿವೆ?', context: 'ಸಣ್ಣ ಆಲೋಚನೆಗಳು ಮತ್ತು ಆಯ್ಕೆಗಳು ನಾಳೆಯ ಅಭ್ಯಾಸಗಳನ್ನು ರೂಪಿಸಬಹುದು.', interpretation: 'ನಮ್ಮ ಮೌಲ್ಯಗಳನ್ನು ತೋರಿಸುವ ಆಲೋಚನೆ ಮತ್ತು ಕಾರ್ಯಗಳನ್ನು ಆರಿಸಲು ಈ ಬೋಧನೆ ಪ್ರೇರೇಪಿಸುತ್ತದೆ.', takeaway: 'ಇಂದು ಅಭ್ಯಾಸ ಮಾಡಲು ಯೋಗ್ಯವಾದ ಒಂದು ಆಲೋಚನೆಯನ್ನು ಆರಿಸಿ.', closing: 'ನೀವು ಆಗ ಬಯಸುವುದನ್ನು ಅಭ್ಯಾಸ ಮಾಡಿ.' },
  },
  'service-001': {
    English: { title: 'Service: make your strength useful', hook: 'Who could benefit from the strength you are building?', context: 'A skill or opportunity gains meaning when it can also help someone beyond ourselves.', interpretation: 'This teaching on service asks us to connect our own growth with the wellbeing of others.', takeaway: 'Offer one useful act of help today.', closing: 'Let your effort reach someone.' },
    Hindi: { title: 'सेवा: अपनी शक्ति को उपयोगी बनाइए', hook: 'किसे आपकी बनाई हुई शक्ति से लाभ हो सकता है?', context: 'कौशल या अवसर तब अर्थपूर्ण बनता है जब वह दूसरों की सेवा में भी प्रयोग हो।', interpretation: 'यह शिक्षण हमें अपने विकास को दूसरों की भलाई से जोड़ने के लिए प्रेरित करता है।', takeaway: 'आज एक उपयोगी मदद का काम कीजिए।', closing: 'अपना प्रयास किसी तक पहुँचने दें।' },
    Punjabi: { title: 'ਸੇਵਾ: ਆਪਣੀ ਸ਼ਕਤੀ ਨੂੰ ਲਾਭਦਾਇਕ ਬਣਾਓ', hook: 'ਕੌਣ ਉਸ ਸ਼ਕਤੀ ਤੋਂ ਲਾਭ ਲੈ ਸਕਦਾ ਹੈ ਜੋ ਤੁਸੀਂ ਬਣਾ ਰਹੇ ਹੋ?', context: 'ਕੁਸ਼ਲਤਾ ਜਾਂ ਮੌਕਾ ਉਦੋਂ ਅਰਥਪੂਰਨ ਬਣਦਾ ਹੈ ਜਦੋਂ ਉਹ ਦੂਜਿਆਂ ਦੀ ਸੇਵਾ ਵਿੱਚ ਵੀ ਵਰਤਿਆ ਜਾਵੇ।', interpretation: 'ਇਹ ਸਿੱਖਿਆ ਸਾਨੂੰ ਆਪਣੇ ਵਿਕਾਸ ਨੂੰ ਦੂਜਿਆਂ ਦੀ ਭਲਾਈ ਨਾਲ ਜੋੜਨ ਲਈ ਪ੍ਰੇਰਿਤ ਕਰਦੀ ਹੈ।', takeaway: 'ਅੱਜ ਇੱਕ ਲਾਭਦਾਇਕ ਸਹਾਇਤਾ ਕਰੋ।', closing: 'ਆਪਣਾ ਯਤਨ ਕਿਸੇ ਤੱਕ ਪਹੁੰਚਣ ਦਿਓ।' },
    Kannada: { title: 'ಸೇವೆ: ನಿಮ್ಮ ಶಕ್ತಿಯನ್ನು ಉಪಯುಕ್ತವಾಗಿಸಿ', hook: 'ನೀವು ಬೆಳೆಸುತ್ತಿರುವ ಶಕ್ತಿಯಿಂದ ಯಾರಿಗೆ ಸಹಾಯವಾಗಬಹುದು?', context: 'ನಮ್ಮ ಕೌಶಲ್ಯ ಅಥವಾ ಅವಕಾಶವು ಇತರರಿಗೂ ಸಹಾಯವಾದಾಗ ಅರ್ಥಪೂರ್ಣವಾಗುತ್ತದೆ.', interpretation: 'ನಮ್ಮ ಬೆಳವಣಿಗೆಯನ್ನು ಇತರರ ಒಳಿತಿನೊಂದಿಗೆ ಜೋಡಿಸಲು ಈ ಬೋಧನೆ ಹೇಳುತ್ತದೆ.', takeaway: 'ಇಂದು ಒಂದು ಉಪಯುಕ್ತ ಸಹಾಯ ಮಾಡಿ.', closing: 'ನಿಮ್ಮ ಪ್ರಯತ್ನ ಯಾರಿಗಾದರೂ ತಲುಪಲಿ.' },
  },
  'discipline-001': {
    English: { title: 'Discipline: keep one promise', hook: 'Which small promise to yourself is worth keeping today?', context: 'A routine becomes meaningful through steady practice, not a perfect start.', interpretation: 'This teaching on discipline emphasizes returning to practice consistently, even when conditions change.', takeaway: 'Keep one small commitment today.', closing: 'Show up again tomorrow.' },
    Hindi: { title: 'अनुशासन: एक वचन निभाइए', hook: 'आज आपके लिए कौन-सा छोटा वचन सबसे महत्वपूर्ण है?', context: 'नियमित अभ्यास से आदत अर्थपूर्ण बनती है, पूर्ण शुरुआत से नहीं।', interpretation: 'यह शिक्षण अनुशासन को निरंतर अभ्यास के रूप में समझाता है, चाहे परिस्थितियाँ बदलें।', takeaway: 'आज एक छोटा वचन निभाइए।', closing: 'कल फिर से मिलते हैं।' },
    Punjabi: { title: 'ਕਲਪਨਾ: ਇੱਕ ਵਾਧੀ ਰੱਖੋ', hook: 'ਅੱਜ ਤੁਹਾਡੇ ਲਈ ਕਿਹੜਾ ਛੋਟਾ ਵਾਧੀ ਸਭ ਤੋਂ ਮਹੱਤਵਪੂਰਨ ਹੈ?', context: 'ਰੁਟੀਨ ਇਕ ਸਹੀ ਅਭਿਆਸ ਨਾਲ ਅਰਥਪੂਰਨ ਬਣਦੀ ਹੈ, ਪੂਰੀ ਸ਼ੁਰੂਆਤ ਨਾਲ ਨਹੀਂ।', interpretation: 'ਇਹ ਸਿੱਖਿਆ ਅਨੁਸ਼ਾਸਨ ਨੂੰ ਨਿਰੰਤਰ ਅਭਿਆਸ ਦੇ ਰੂਪ ਵਿੱਚ ਦਰਸਾਉਂਦੀ ਹੈ, ਭਾਵੇਂ ਹਾਲਤ ਬਦਲ ਜਾਵੇ।', takeaway: 'ਅੱਜ ਇੱਕ ਛੋਟਾ ਵਾਧੀ ਰੱਖੋ।', closing: 'ਕੱਲ੍ਹਾ ਫਿਰ ਜੁੜਿਆ ਜਾਵੇਗਾ।' },
    Kannada: { title: 'ಶಿಸ್ತು: ಒಂದು ಮಾತನ್ನು ಉಳಿಸಿಕೊಳ್ಳಿ', hook: 'ಇಂದು ನಿಮಗೆ ನೀವೇ ಕೊಟ್ಟ ಯಾವ ಸಣ್ಣ ಮಾತನ್ನು ಉಳಿಸಿಕೊಳ್ಳುತ್ತೀರಿ?', context: 'ಪೂರ್ಣ ಆರಂಭದಿಂದಲ್ಲ, ನಿರಂತರ ಅಭ್ಯಾಸದಿಂದ ದಿನಚರಿ ಅರ್ಥಪೂರ್ಣವಾಗುತ್ತದೆ.', interpretation: 'ಪರಿಸ್ಥಿತಿಗಳು ಬದಲಾದರೂ ಅಭ್ಯಾಸಕ್ಕೆ ಮರಳುವುದೇ ಶಿಸ್ತು ಎಂದು ಈ ಬೋಧನೆ ತಿಳಿಸುತ್ತದೆ.', takeaway: 'ಇಂದು ಒಂದು ಸಣ್ಣ ಬದ್ಧತೆಯನ್ನು ಉಳಿಸಿಕೊಳ್ಳಿ.', closing: 'ನಾಳೆಯೂ ಮತ್ತೆ ಮುಂದುವರಿಯಿರಿ.' },
  },
}

const fallbackScript = (teaching, language, template) => {
  const copy = fallbackThemes[teaching.id]?.[language]
  if (!copy) throw Object.assign(new Error('No fallback script for this teaching and language.'), { status: 400 })
  const hook = template === 'Quote focused'
    ? language === 'English' ? `One thought to carry with you: ${teaching.topic.toLowerCase()}.` : language === 'Hindi' ? `${teaching.topic} पर एक विचार।` : language === 'Punjabi' ? `${teaching.topic} ਬਾਰੇ ਇੱਕ ਸੋਚ।` : `${teaching.topic} ಕುರಿತು ಒಂದು ಚಿಂತನೆ.`
    : copy.hook
  const interpretation = copy.interpretation
  const visuals = {
    Courage: 'An anonymous student pauses before taking a step along an open trail.',
    Character: 'A student studies quietly in warm natural light.',
    Practice: 'Close-up of a notebook and focused hands at a clear desk.',
    Learning: 'A student studies beside an open window at morning light.',
    Values: 'An anonymous student makes a thoughtful choice in a quiet setting.',
    Action: 'Hands arrange supplies for a community activity, faces out of frame.',
  }
  const visual = visuals[teaching.category] ?? 'A quiet landscape in warm morning light.'
  return {
    title: copy.title,
    hook,
    context: copy.context,
    original_teaching: teaching.original_text,
    source: teaching.source,
    ai_interpretation: `AI Interpretation — Not an Original Quote: ${interpretation}`,
    takeaway: copy.takeaway,
    closing: copy.closing,
    language,
    duration: 42,
    scenes: [
      { scene_number: 1, duration: 6, type: 'Hook', narration: hook, on_screen_text: hook, visual_description: visual },
      { scene_number: 2, duration: 7, type: 'Context', narration: copy.context, on_screen_text: copy.context, visual_description: visual },
      { scene_number: 3, duration: 8, type: 'Original teaching', narration: teaching.original_text, on_screen_text: teaching.original_text, visual_description: 'A clear source card with the exact teaching and citation.' },
      { scene_number: 4, duration: 8, type: 'AI interpretation', narration: interpretation, on_screen_text: interpretation, visual_description: 'An anonymous student reflects, with a quiet landscape in the background.' },
      { scene_number: 5, duration: 7, type: 'Modern takeaway', narration: copy.takeaway, on_screen_text: copy.takeaway, visual_description: visual },
      { scene_number: 6, duration: 6, type: 'Closing', narration: copy.closing, on_screen_text: copy.closing, visual_description: 'An open path in warm morning light.' },
    ],
  }
}

const requestOpenAI = async (teaching, language, template) => {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(25000),
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Create a short educational reel script in JSON. Never invent or rewrite historical quotations. Return keys: title, hook, context, original_teaching, source, ai_interpretation, takeaway, closing, language, duration, scenes. scenes must be six objects with scene_number, duration, type, narration, on_screen_text, visual_description. Total duration must be 30-60 seconds. Prefix ai_interpretation with "AI Interpretation — Not an Original Quote:". Keep hook/context/takeaway/closing and scene narration in the requested language. Copy original_teaching and source exactly as supplied. Keep narration concise enough for the duration.' },
        { role: 'user', content: JSON.stringify({ teaching: { topic: teaching.topic, category: teaching.category, original_teaching: teaching.original_text, source: teaching.source }, language, template }) },
      ],
    }),
  })
  if (!response.ok) throw new Error('Generation provider unavailable')
  const data = await response.json()
  return JSON.parse(data.choices?.[0]?.message?.content ?? '{}')
}

const validateGenerated = (generated, teaching, language) => {
  if (generated.original_teaching !== teaching.original_text || generated.source !== teaching.source) {
    throw Object.assign(new Error('Source validation failed'), { status: 422 })
  }
  const scenes = generated.scenes
  if (!Array.isArray(scenes) || scenes.length !== 6 || scenes.some((scene) => typeof scene.narration !== 'string' || !Number.isFinite(scene.duration))) {
    throw Object.assign(new Error('Storyboard validation failed'), { status: 422 })
  }
  const duration = scenes.reduce((total, scene) => total + scene.duration, 0)
  if (duration < 30 || duration > 60 || generated.language !== language) {
    throw Object.assign(new Error('Reel validation failed'), { status: 422 })
  }
  const originalScene = scenes.find((scene) => scene.type === 'Original teaching')
  if (!originalScene || originalScene.narration !== teaching.original_text || originalScene.on_screen_text !== teaching.original_text) {
    throw Object.assign(new Error('Original teaching scene validation failed'), { status: 422 })
  }
  if (!String(generated.ai_interpretation).startsWith('AI Interpretation — Not an Original Quote:')) {
    throw Object.assign(new Error('Interpretation label validation failed'), { status: 422 })
  }
  return { ...generated, original_teaching: teaching.original_text, source: teaching.source, duration }
}

app.get('/api/health', (_request, response) => response.json({
  status: 'ok',
  generation: process.env.OPENAI_API_KEY ? 'live' : 'demo',
  video_generation: isVeoConfigured() ? 'google-veo-3.1' : 'local-motion-cards',
  social_publishing: isYouTubeConfigured() ? 'youtube-ready' : 'youtube-needs-google-oauth',
}))
app.get('/api/reels', async (_request, response) => {
  try {
    const files = await readdir(reelOutputDirectory)
    const records = await listReelRecords()
    const reels = await Promise.all(files
      .filter((file) => /^[0-9a-f-]{36}\.mp4$/i.test(file))
      .map(async (file) => {
        const id = file.slice(0, -4)
        const details = await stat(path.join(reelOutputDirectory, file))
        const record = records.find((item) => item.id === id)
        return { id, video_url: `/media/${file}`, created_at: record?.created_at ?? details.mtime.toISOString(), bytes: details.size, ...(record ?? {}) }
      }))
    response.json(reels.sort((left, right) => right.created_at.localeCompare(left.created_at)).slice(0, 25))
  } catch {
    response.json([])
  }
})
app.get('/api/social/status', async (_request, response) => {
  try {
    const [youtube, posts] = await Promise.all([getYouTubeStatus(), listYouTubePosts()])
    response.json({ youtube, posts })
  } catch {
    response.status(503).json({ error: 'Social publishing status is temporarily unavailable.' })
  }
})
app.get('/api/social/youtube/connect', async (_request, response) => {
  try {
    response.redirect(302, await createYouTubeAuthorizationUrl())
  } catch {
    response.status(503).json({ error: 'YouTube OAuth is not configured. Add Google OAuth credentials first.' })
  }
})
app.get('/api/social/youtube/callback', async (request, response) => {
  if (request.query.error) return response.redirect(302, 'http://localhost:5173/?view=distribution&social=access-denied')
  try {
    await completeYouTubeAuthorization({ code: request.query.code, state: request.query.state })
    response.redirect(302, 'http://localhost:5173/?view=distribution&social=youtube-connected')
  } catch (error) {
    const reason = error.status === 400 ? 'oauth-state-error' : 'youtube-connect-error'
    response.redirect(302, `http://localhost:5173/?view=distribution&social=${reason}`)
  }
})
app.delete('/api/social/youtube/connection', async (_request, response) => {
  try {
    await disconnectYouTube()
    response.json({ disconnected: true })
  } catch {
    response.status(503).json({ error: 'Could not disconnect YouTube right now.' })
  }
})
app.get('/api/social/posts', async (_request, response) => {
  try {
    response.json(await listYouTubePosts())
  } catch {
    response.status(503).json({ error: 'Published reels are temporarily unavailable.' })
  }
})
app.get('/api/social/youtube/analytics/:videoId', async (request, response) => {
  try {
    response.json(await getYouTubeAnalytics(request.params.videoId))
  } catch (error) {
    response.status(error.status ?? 503).json({ error: error.status === 404 ? error.message : 'YouTube analytics are temporarily unavailable.' })
  }
})
app.post('/api/social/youtube/upload', async (request, response) => {
  const { video_id: videoId, title, privacy_status: privacyStatus = 'private' } = request.body ?? {}
  const reel = await getReelRecord(videoId)
  const teaching = teachingRecords.find((record) => record.id === reel?.teaching_id)
  if (!teaching || teaching.verification_status !== 'verified' || !teaching.original_text || !teaching.source_url) {
    return response.status(403).json({ error: 'This reel has no saved verified teaching record and cannot be published.' })
  }
  try {
    response.status(201).json(await uploadYouTubeShort({ videoId, teaching, title: title ?? reel.title, privacyStatus }))
  } catch (error) {
    response.status(error.status ?? 503).json({ error: error.status ? error.message : 'YouTube could not publish this reel. Check the channel connection and try again.' })
  }
})
app.get('/api/library', async (_request, response) => {
  try {
    response.json(await listLibraryMomentIds())
  } catch {
    response.status(503).json({ error: 'Library data is temporarily unavailable.' })
  }
})
app.post('/api/library', async (request, response) => {
  const { moment_ids: momentIds } = request.body ?? {}
  try {
    response.json(await saveLibraryMomentIds(momentIds))
  } catch {
    response.status(503).json({ error: 'Library data could not be saved.' })
  }
})
app.get('/api/teachings', (_request, response) => response.json(teachingRecords))
app.get('/api/teachings/:id', (request, response) => {
  const teaching = teachingRecords.find((record) => record.id === request.params.id)
  if (!teaching) return response.status(404).json({ error: 'Teaching not found.' })
  response.json(teaching)
})
app.post('/api/generate-reel', async (request, response) => {
  const { teaching_id: teachingId, language = 'English', template = 'Storytelling' } = request.body ?? {}
  const teaching = teachingRecords.find((record) => record.id === teachingId)
  if (!teaching) return response.status(404).json({ error: 'This teaching could not be found.' })
  if (teaching.verification_status !== 'verified' || !teaching.original_text || !teaching.source || !teaching.source_url) {
    return response.status(403).json({ error: 'This teaching does not have a verified source.' })
  }
  if (!languages.has(language)) return response.status(400).json({ error: 'This language is not supported yet.' })
  if (!templates.has(template)) return response.status(400).json({ error: 'This reel format is not supported yet.' })
  try {
    const generated = process.env.OPENAI_API_KEY ? await requestOpenAI(teaching, language, template) : fallbackScript(teaching, language, template)
    return response.json(validateGenerated(generated, teaching, language))
  } catch (error) {
    const status = error.status ?? 503
    return response.status(status).json({ error: status === 422 ? 'The generated source did not pass verification.' : 'Reel generation is temporarily unavailable.' })
  }
})
app.post('/api/compose-video', async (request, response) => {
  const { teaching_id: teachingId, script } = request.body ?? {}
  const teaching = teachingRecords.find((record) => record.id === teachingId)
  if (!teaching || teaching.verification_status !== 'verified' || !teaching.original_text || !teaching.source_url) {
    return response.status(403).json({ error: 'A verified teaching is required to compose a reel.' })
  }
  try {
    const validated = validateGenerated(script ?? {}, teaching, script?.language)
    const reelMetadata = {
      teaching_id: teaching.id,
      topic: teaching.topic,
      original_teaching: teaching.original_text,
      source: teaching.source,
      source_url: teaching.source_url,
      title: validated.title,
    }
    if (isVeoConfigured()) {
      const job = await startVeoVideoJob({ script: validated, teaching, composeVideo, reelMetadata })
      return response.status(202).json(job)
    }
    return response.status(201).json(await composeVideo(validated, { reelMetadata }))
  } catch (error) {
    const status = error.status ?? 503
    return response.status(status).json({ error: status === 422 ? 'The reel failed source validation.' : 'Reel composition is temporarily unavailable.' })
  }
})
app.get('/api/video-jobs/:id', (request, response) => {
  const job = getVeoVideoJob(request.params.id)
  if (!job) return response.status(404).json({ error: 'This video job could not be found.' })
  response.json(job)
})

app.use((_request, response) => response.status(404).json({ error: 'That resource was not found.' }))
app.use((error, _request, response, _next) => {
  const status = Number.isInteger(error.status) ? error.status : 400
  response.status(status).json({ error: status === 404 ? 'That resource was not found.' : 'This request could not be processed.' })
})
app.listen(port, () => console.log(`Teaching-to-Reel API ready at http://localhost:${port}`))