/* ═══════════════════════════════════════════════════════════════
   0175 — sixty more riddles

   The Daily Riddle had 30 riddles (2026-08-29 … 2026-09-27, 0022 and
   0121) and would have run out on 27 September 2026. This adds sixty
   more, one a day, 2026-09-28 … 2026-11-26.

   WHERE THE RIDDLES COME FROM. The owner's rule: every riddle is either
   original, or drawn from the traditional Urdu/Punjabi folk riddles
   (پہیلیاں) of the oral tradition, and even then written anew in our
   own words. Nothing is copied from a published collection, a book or
   a puzzle website. A few below echo old folk motifs (a tray of pearls
   turned upside down over everyone's head; a green-shawled lady in the
   field with pearls in rows; thirty-two white guards around a soft
   neighbour; the one that makes you cry without hitting you; a box of
   rubies; four legs that never walk). Each of those was re-written
   here, not transcribed.

   WHO THEY ARE FOR. Icons of 60 to 90 in Pakistan, in English and in
   Urdu. Everyday, warm, familiar things: the courtyard, the kitchen,
   the bazaar, the village, seasons, Eid, old objects. Nothing morbid,
   political, religiously contested or embarrassing.

   THE SAME LADDER AS 0121, three hints in both languages:
     1. a nudge — how to read the riddle, what kind of thing it is
     2. closer — where it lives, what it does
     3. nearly there — a plain description and the first letter,
        never the answer itself
   hint_en / hint_ur (the single legacy hint) = the second hint, so a
   copy of the app that has not reloaded still shows one hint.

   ANSWERS are stored already normalised the way guess_daily_puzzle
   normalises a guess — lower(btrim(regexp_replace(guess,
   '[^[:alnum:]؀-ۿ ]', '', 'g'))) — lowercase, no punctuation, with
   the common alternatives: singular/plural, spellings, both Urdu
   spellings, and the transliterated word people type in English
   letters (charpai, charpoy). No answer repeats any earlier riddle's.

   Re-runnable: rows are upserted by date. The file is three
   self-contained parts of twenty riddles each (each loads a temp
   table, upserts, drops it), so any part can be re-applied alone.
   ═══════════════════════════════════════════════════════════════ */

/* ─── part 1 of 3: 2026-09-28 … 2026-10-17 ─── */

drop table if exists pg_temp.riddle_src;
create temp table riddle_src (
  d        date primary key,
  r_en     text   not null,
  r_ur     text   not null,
  h_en     text[] not null,
  h_ur     text[] not null,
  answers  text[] not null
);

insert into riddle_src (d, r_en, r_ur, h_en, h_ur, answers) values

('2026-09-28',
 'Four legs, but I never walk; my back is woven from rope, and the whole family sits on me in the courtyard. What am I?',
 'چار پاؤں ہیں پر چلتی نہیں، پیٹھ رسی سے بنی ہے، سارا گھر آنگن میں مجھ پر بیٹھتا ہے۔ میں کیا ہوں؟',
 array['It is a piece of furniture, and its legs are made of wood.',
       'It stands in the courtyard or on the roof, and in summer people sleep on it under the open sky.',
       'A wooden frame with four legs, strung with rope or nawar for sleeping. It starts with C.'],
 array['یہ فرنیچر ہے، اور اس کے پائے لکڑی کے ہوتے ہیں۔',
       'آنگن یا چھت پر بچھی رہتی ہے، گرمیوں میں لوگ اس پر کھلے آسمان تلے سوتے ہیں۔',
       'لکڑی کا ڈھانچہ، چار پائے، رسی یا نواڑ سے بنا ہوا، سونے کے لیے۔ پہلا حرف «چ» ہے۔'],
 array['charpai','charpoy','charpoi','charpaee','cot','manji','چارپائی','چار پائی','چارپائ','منجی','منجا']),

('2026-09-29',
 'A little fire lives in my glass belly; carry me by my handle and I chase the dark out of the village lane. What am I?',
 'میرے شیشے کے پیٹ میں ننھی سی آگ رہتی ہے؛ کنڈے سے پکڑ کر لے چلو تو گاؤں کی گلی سے اندھیرا بھاگ جائے۔ میں کیا ہوں؟',
 array['It was a friend in the days before electricity reached every home.',
       'It burns kerosene, and you turn a little knob to raise or lower its flame.',
       'A metal frame with a glass chimney, hung on a hook when the power goes. It starts with L.'],
 array['یہ ان دنوں کا ساتھی ہے جب ہر گھر میں بجلی نہیں تھی۔',
       'مٹی کے تیل سے جلتی ہے، اور چھوٹی سی گھنڈی گھما کر اس کی لو اونچی نیچی کرتے ہیں۔',
       'دھات کا ڈھانچہ اور شیشے کی چمنی، بجلی جائے تو کیل پر ٹانگ دیتے ہیں۔ پہلا حرف «ل» ہے۔'],
 array['lantern','lanterns','lamp','lalten','laltain','lalteen','hurricane lamp','لالٹین','لالٹن','لیمپ']),

('2026-09-30',
 'On a hot afternoon I am waved back and forth; I have no breath of my own, yet I give you a breeze. What am I?',
 'گرم دوپہر میں ادھر ادھر جھلایا جاتا ہوں، اپنی سانس نہیں رکھتا پھر بھی ہوا دیتا ہوں۔ میں کیا ہوں؟',
 array['Think of what people held in their hands before electricity, when the heat was too much.',
       'It is often woven from palm leaves, sometimes with a coloured cloth border.',
       'You hold its handle and wave it near your face to cool down. Two words, and the first starts with H.'],
 array['بجلی سے پہلے گرمی میں لوگ ہاتھ میں کیا لیے رہتے تھے؟',
       'اکثر کھجور کے پتوں سے بنا جاتا ہے، کبھی رنگین کپڑے کی جھالر کے ساتھ۔',
       'دستہ پکڑ کر چہرے کے پاس ہلاتے ہیں تو ٹھنڈک ملتی ہے۔ پہلا حرف «پ» ہے۔'],
 array['hand fan','handfan','fan','pankha','pankhi','hath pankha','پنکھا','پنکھی','دستی پنکھا','ہاتھ کا پنکھا']),

('2026-10-01',
 'A long thin neck and a round clay belly; the hotter the month, the cooler the water I give. What am I?',
 'لمبی پتلی گردن، مٹی کا گول پیٹ؛ مہینہ جتنا گرم، میرا پانی اتنا ٹھنڈا۔ میں کیا ہوں؟',
 array['It is made by a potter.',
       'It stands in a corner of the house in summer, keeping drinking water cool without a fridge.',
       'A clay water jug with a slender neck, often with a small cup turned over its mouth. It starts with S.'],
 array['کمہار کے ہاتھ کی بنی ہے۔',
       'گرمیوں میں گھر کے کونے میں رکھی رہتی ہے، فریج کے بغیر پانی ٹھنڈا رکھتی ہے۔',
       'مٹی کا پانی کا برتن، پتلی سی گردن، اوپر اکثر ایک پیالی الٹی رکھی ہوتی ہے۔ پہلا حرف «ص» ہے۔'],
 array['surahi','surai','suraahi','surahee','صراحی']),

('2026-10-02',
 'I eat wood and dung cakes, I breathe out smoke, and the cooking pot sits on my head. What am I?',
 'لکڑی اور اپلے کھاتا ہوں، دھواں نکالتا ہوں، اور ہانڈی میرے سر پر بیٹھتی ہے۔ میں کیا ہوں؟',
 array['It lives in a kitchen, especially in a village.',
       'It is made of clay or bricks, and a fire is lit inside it.',
       'A low clay hearth where every meal of the house was once cooked. It starts with C.'],
 array['یہ باورچی خانے میں رہتا ہے، خاص طور پر گاؤں میں۔',
       'مٹی یا اینٹوں کا بنا ہوتا ہے، اور اس کے اندر آگ جلائی جاتی ہے۔',
       'مٹی کی بنی نیچی سی جگہ جہاں آگ جلا کر کبھی گھر کا ہر کھانا پکتا تھا۔ پہلا حرف «چ» ہے۔'],
 array['chulha','chula','choolha','chulah','stove','clay stove','mud stove','چولہا','چولھا']),

('2026-10-03',
 'My belly is a fire in the ground; slap the dough onto my hot walls and I hand it back as bread. What am I?',
 'میرا پیٹ زمین میں آگ ہے؛ آٹا میری گرم دیواروں پر لگاؤ تو پکا کر لوٹا دوں۔ میں کیا ہوں؟',
 array['Think of the neighbourhood bakery where you buy naan in the evening.',
       'It is a deep clay pot, sunk in the ground or set in bricks, very hot inside.',
       'A deep clay pit of fire where naan bakes stuck to the sides. It starts with T.'],
 array['محلے کے اس ٹھکانے کا سوچیں جہاں شام کو نان لینے جاتے ہیں۔',
       'مٹی کا گہرا برتن، زمین میں دبا ہوا یا اینٹوں میں جڑا، اندر سے بہت گرم۔',
       'آگ سے دہکتا گہرا برتن جس کی دیواروں پر نان پکتے ہیں۔ پہلا حرف «ت» ہے۔'],
 array['tandoor','tandur','tanoor','tannoor','oven','clay oven','تندور','تنور']),

('2026-10-04',
 'Two partners in the kitchen: one sits still with its mouth open, the other jumps up and down, and the spices cry out between them. What are they?',
 'باورچی خانے کے دو ساتھی: ایک منہ کھولے بیٹھا رہے، دوسرا اچھلتا رہے، اور بیچ میں مصالحہ چیخے۔ وہ کیا ہیں؟',
 array['They are a pair, and they always work together.',
       'They are made of stone, brass or wood, and they crush garlic, ginger and spices.',
       'A heavy bowl and a short club for pounding. Three words, and the first starts with M.'],
 array['یہ جوڑی ہے، اور ہمیشہ مل کر کام کرتی ہے۔',
       'پتھر، پیتل یا لکڑی کے ہوتے ہیں، اور لہسن، ادرک، مصالحہ کوٹتے ہیں۔',
       'ایک بھاری پیالہ اور ایک چھوٹا سا ڈنڈا، کوٹنے کے لیے۔ پہلا حرف «ہ» ہے۔'],
 array['mortar and pestle','pestle and mortar','mortar pestle','mortar','pestle','hawan dasta','havan dasta','imam dasta','kundi danda','ہاون دستہ','ہاون','امام دستہ','کونڈی ڈنڈا','کونڈی','اوکھلی']),

('2026-10-05',
 'My needle goes up and down a thousand times, yet I have no fingers; turn my wheel and a new kurta is born. What am I?',
 'میری سوئی ہزار بار اوپر نیچے جاتی ہے، مگر میری انگلیاں نہیں؛ میرا پہیہ گھماؤ تو نیا کرتا تیار۔ میں کیا ہوں؟',
 array['Many homes kept one in a corner under an embroidered cover.',
       'Mothers and tailors use it before Eid, turning a wheel by hand or pushing a pedal with the foot.',
       'It stitches cloth quickly, with thread running from a spool. Two words, and the first starts with S.'],
 array['بہت سے گھروں میں ایک کونے میں کڑھائی والے غلاف کے نیچے رکھی رہتی تھی۔',
       'عید سے پہلے مائیں اور درزی اسے چلاتے ہیں، ہاتھ سے پہیہ گھما کر یا پاؤں سے پیڈل دبا کر۔',
       'یہ دھاگے کی ریل سے تیز تیز کپڑا سیتی ہے۔ دو لفظ ہیں، پہلا حرف «س» ہے۔'],
 array['sewing machine','sewingmachine','silai machine','machine','سلائی مشین','مشین']),

('2026-10-06',
 'I sing, I read the news and I tell you the cricket score, yet I have no mouth. Turn my knob and I speak. What am I?',
 'گاتا ہوں، خبریں سناتا ہوں، کرکٹ کا اسکور بتاتا ہوں، مگر منہ نہیں۔ بٹن گھماؤ تو بولوں۔ میں کیا ہوں؟',
 array['You listen to it; there is nothing to watch.',
       'Families once gathered around it for the evening news and old film songs.',
       'A box with an aerial and a dial that catches voices from far away. It starts with R.'],
 array['اسے سنتے ہیں، دیکھنے کو کچھ نہیں ہوتا۔',
       'کبھی گھر والے شام کی خبروں اور پرانے فلمی گانوں کے لیے اس کے گرد بیٹھتے تھے۔',
       'انٹینا اور سوئی والا ڈبہ جو دور کی آوازیں پکڑتا ہے۔ پہلا حرف «ر» ہے۔'],
 array['radio','transistor','redio','ریڈیو','ٹرانزسٹر']),

('2026-10-07',
 'Two wheels, no engine, and no petrol; your own legs are all the fuel it needs. What is it?',
 'دو پہیے، انجن نہیں، پیٹرول بھی نہیں چاہیے؛ آپ کی ٹانگیں ہی اس کا ایندھن ہیں۔ یہ کیا ہے؟',
 array['You ride it.',
       'The milkman and the postman used to come on it, ringing a little bell.',
       'You sit on its seat and push the pedals round. It starts with B.'],
 array['اس پر سواری کی جاتی ہے۔',
       'دودھ والا اور ڈاکیا اسی پر گھنٹی بجاتے آتے تھے۔',
       'سیٹ پر بیٹھ کر پیڈل گھماتے ہیں۔ پہلا حرف «س» ہے۔'],
 array['bicycle','bicycles','cycle','bike','saikal','سائیکل','بائیسکل']),

('2026-10-08',
 'When the sky cries I open wide, and when the sky smiles I fold myself away. What am I?',
 'آسمان روئے تو میں کھل جاؤں، آسمان مسکرائے تو سمٹ جاؤں۔ میں کیا ہوں؟',
 array['The sky crying is rain; think of what you carry for it.',
       'It has a handle and thin metal ribs under cloth, and it keeps your head dry.',
       'You hold it over your head in the monsoon or the hot sun. It starts with U.'],
 array['آسمان کا رونا بارش ہے؛ سوچیں اس کے لیے کیا ساتھ لیتے ہیں۔',
       'اس کا دستہ ہوتا ہے، کپڑے کے نیچے دھات کی پتلی تیلیاں، اور یہ سر کو بھیگنے سے بچاتی ہے۔',
       'ساون میں یا تیز دھوپ میں سر کے اوپر تانی جاتی ہے۔ پہلا حرف «چ» ہے۔'],
 array['umbrella','umbrellas','chhatri','chatri','chhatta','chata','چھتری','چھاتا']),

('2026-10-09',
 'I walk beside you all day and copy everything you do, but when the lights go out, I go too. What am I?',
 'سارا دن آپ کے ساتھ چلوں اور ہر حرکت کی نقل کروں، مگر اندھیرا ہو تو میں بھی چلا جاؤں۔ میں کیا ہوں؟',
 array['It is not a person, though it has your shape.',
       'The sun or a lamp makes it, and it grows longest in the evening.',
       'A dark shape on the ground that follows you. It starts with S.'],
 array['یہ کوئی شخص نہیں، حالانکہ اس کی شکل آپ جیسی ہے۔',
       'سورج یا چراغ اسے بناتا ہے، اور شام کو یہ سب سے لمبا ہوتا ہے۔',
       'زمین پر ایک کالی سی شکل جو آپ کے پیچھے پیچھے چلتی ہے۔ پہلا حرف «س» ہے۔'],
 array['shadow','shadows','saya','saaya','parchhai','parchhain','سایہ','سائے','پرچھائیں','پرچھائی']),

('2026-10-10',
 'A little leathery box: break it open and hundreds of red jewels sit packed inside. What is it?',
 'چمڑے جیسی ننھی سی ڈبیا، توڑو تو اندر سینکڑوں لال موتی جڑے ملیں۔ یہ کیا ہے؟',
 array['It is a fruit.',
       'Its seeds are juicy and red, and its juice is sold at stalls in autumn.',
       'A round fruit with a little crown on top and ruby seeds inside. It starts with P.'],
 array['یہ ایک پھل ہے۔',
       'اس کے دانے رسیلے اور لال ہیں، خزاں میں ٹھیلوں پر اس کا رس بکتا ہے۔',
       'گول پھل، اوپر ننھا سا تاج، اندر یاقوت جیسے دانے۔ پہلا حرف «ا» ہے۔'],
 array['pomegranate','pomegranates','anar','anaar','انار']),

('2026-10-11',
 'Green when I am young and red when I am old; small and slim, but bite me and your eyes will water. What am I?',
 'چھوٹی ہوں تو ہری، بڑی ہوں تو لال؛ ذرا سی پتلی سی، مگر کاٹو تو آنکھوں میں پانی آ جائے۔ میں کیا ہوں؟',
 array['It is something from the kitchen that makes food hot.',
       'It is bought by the pao at the vegetable stall, and it goes into almost every salan.',
       'A thin, hot pod, green or red. It starts with C.'],
 array['باورچی خانے کی چیز جو کھانا تیز کرتی ہے۔',
       'سبزی والے سے پاؤ کے حساب سے لیتے ہیں، اور تقریباً ہر سالن میں پڑتی ہے۔',
       'پتلی سی تیز پھلی، ہری یا لال۔ پہلا حرف «م» ہے۔'],
 array['chilli','chillies','chili','chilies','chilly','mirch','mirchi','green chilli','red chilli','مرچ','مرچی','مرچیں','ہری مرچ','لال مرچ']),

('2026-10-12',
 'I never hit anyone, yet whoever cuts me cries; take off one coat and there is another coat underneath. What am I?',
 'کسی کو مارتا نہیں، پھر بھی جو کاٹے رو دے؛ ایک چھلکا اتارو تو نیچے اور چھلکا۔ میں کیا ہوں؟',
 array['It is a vegetable, and it grows under the ground.',
       'Almost every salan begins by frying it golden in oil.',
       'Round, with papery skin and rings inside; cutting it stings your eyes. It starts with O.'],
 array['یہ سبزی ہے، اور زمین کے نیچے اگتی ہے۔',
       'تقریباً ہر سالن اسے تیل میں سنہرا کرنے سے شروع ہوتا ہے۔',
       'گول، کاغذ جیسا چھلکا، اندر پرتیں؛ کاٹتے ہوئے آنکھیں جلتی ہیں۔ پہلا حرف «پ» ہے۔'],
 array['onion','onions','pyaz','piyaz','piaz','پیاز']),

('2026-10-13',
 'Without me the food is sad; with too much of me nobody will eat it. Drop me in water and I vanish. What am I?',
 'میرے بغیر کھانا پھیکا، میں زیادہ ہو جاؤں تو کوئی نہ کھائے۔ پانی میں ڈالو تو غائب۔ میں کیا ہوں؟',
 array['It is in every kitchen, and a pinch is enough.',
       'It is white and fine, and it comes from the sea or from the Khewra mines.',
       'It makes food taste right; sugar is its sweet cousin. It starts with S.'],
 array['ہر باورچی خانے میں ہوتا ہے، اور چٹکی بھر کافی ہے۔',
       'سفید اور باریک، سمندر سے یا کھیوڑہ کی کانوں سے آتا ہے۔',
       'کھانے کا ذائقہ ٹھیک کرتا ہے؛ چینی اس کی میٹھی بہن ہے۔ پہلا حرف «ن» ہے۔'],
 array['salt','namak','نمک']),

('2026-10-14',
 'I wear a crown of flame and cry tears that turn hard, and I bring light when the electricity goes. What am I?',
 'شعلے کا تاج پہنوں، ایسے آنسو بہاؤں جو جم جائیں، اور بجلی جائے تو روشنی لاؤں۔ میں کیا ہوں؟',
 array['Load-shedding is its busy time.',
       'It has a thread in the middle that you light with a match.',
       'A white stick of wax that burns slowly. It starts with C.'],
 array['لوڈشیڈنگ میں اس کی خوب ضرورت پڑتی ہے۔',
       'بیچ میں ایک دھاگہ ہوتا ہے جسے تیلی سے جلاتے ہیں۔',
       'موم کی سفید سی ڈنڈی جو آہستہ آہستہ جلتی ہے۔ پہلا حرف «م» ہے۔'],
 array['candle','candles','mombatti','mombati','mom batti','موم بتی','موم بتیاں','شمع']),

('2026-10-15',
 'I am small enough for your pocket, yet the biggest door in the house waits for me. What am I?',
 'جیب میں آ جاؤں اتنی چھوٹی ہوں، پھر بھی گھر کا سب سے بڑا دروازہ میرا انتظار کرے۔ میں کیا ہوں؟',
 array['It is made of metal and often hangs on a ring with others like it.',
       'You turn it inside a lock.',
       'Without it the front door stays shut. Three letters, starting with K.'],
 array['دھات کی بنی ہے، اور اکثر اپنی جیسی دوسریوں کے ساتھ ایک چھلے میں لٹکتی ہے۔',
       'اسے تالے میں ڈال کر گھماتے ہیں۔',
       'اس کے بغیر گھر کا دروازہ بند ہی رہے۔ پہلا حرف «چ» ہے۔'],
 array['key','keys','chabi','chaabi','chaabee','چابی','چابیاں','کنجی']),

('2026-10-16',
 'I show you your face every morning, but I have no face of my own. What am I?',
 'روز صبح آپ کو آپ کا چہرہ دکھاؤں، مگر میرا اپنا کوئی چہرہ نہیں۔ میں کیا ہوں؟',
 array['It does not speak, yet it never lies about how you look.',
       'It hangs above the sink or stands on the dressing table.',
       'A smooth piece of glass that reflects. It starts with M.'],
 array['بولتا نہیں، مگر آپ کی صورت کے بارے میں کبھی جھوٹ نہیں کہتا۔',
       'منہ دھونے کی جگہ کے اوپر یا سنگھار میز پر لگا ہوتا ہے۔',
       'چکنا سا کانچ جس میں عکس نظر آتا ہے۔ پہلا حرف «آ» ہے۔'],
 array['mirror','mirrors','aina','aaina','aaeena','ayna','shisha','sheesha','آئینہ','آئینا','شیشہ']),

('2026-10-17',
 'Every night a head rests on me; I am stuffed full, but I never eat a thing. What am I?',
 'ہر رات ایک سر مجھ پر ٹکتا ہے؛ میرا پیٹ بھرا ہے مگر میں کچھ کھاتا نہیں۔ میں کیا ہوں؟',
 array['It lives on the bed.',
       'It is soft, filled with cotton or foam, and it wears a cover.',
       'You lay your head on it when you sleep. It starts with P.'],
 array['یہ پلنگ پر رہتا ہے۔',
       'نرم، روئی یا فوم سے بھرا، اور غلاف پہنتا ہے۔',
       'سوتے وقت سر اسی پر رکھتے ہیں۔ پہلا حرف «ت» ہے۔'],
 array['pillow','pillows','takiya','takia','تکیہ','تکیے']);

insert into public.daily_puzzles
  (puzzle_date, riddle_en, riddle_ur, hint_en, hint_ur, hints_en, hints_ur)
select d, r_en, r_ur, h_en[2], h_ur[2], h_en, h_ur
from riddle_src
on conflict (puzzle_date) do update
set riddle_en = excluded.riddle_en,
    riddle_ur = excluded.riddle_ur,
    hint_en   = excluded.hint_en,
    hint_ur   = excluded.hint_ur,
    hints_en  = excluded.hints_en,
    hints_ur  = excluded.hints_ur;

insert into public.daily_puzzle_answers (puzzle_date, answers)
select d, answers
from riddle_src
on conflict (puzzle_date) do update
set answers = excluded.answers;

drop table riddle_src;

/* ─── part 2 of 3: 2026-10-18 … 2026-11-06 ─── */

drop table if exists pg_temp.riddle_src;
create temp table riddle_src (
  d        date primary key,
  r_en     text   not null,
  r_ur     text   not null,
  h_en     text[] not null,
  h_ur     text[] not null,
  answers  text[] not null
);

insert into riddle_src (d, r_en, r_ur, h_en, h_ur, answers) values

('2026-10-18',
 'I come down in a thousand pieces and never break; farmers wait for me and children run out to dance in me. What am I?',
 'ہزار ٹکڑوں میں اتروں مگر ٹوٹوں نہیں؛ کسان میری راہ دیکھیں اور بچے مجھ میں ناچنے نکلیں۔ میں کیا ہوں؟',
 array['It comes from the sky, but it is not snow.',
       'The monsoon brings it, and the earth smells sweet when it first falls.',
       'Drops of water falling from the clouds. It starts with R.'],
 array['آسمان سے آتی ہے، مگر برف نہیں۔',
       'ساون اسے لاتا ہے، اور پہلی بوندوں پر مٹی کی خوشبو اٹھتی ہے۔',
       'بادلوں سے گرتی پانی کی بوندیں۔ پہلا حرف «ب» ہے۔'],
 array['rain','barish','baarish','barsaat','بارش','برسات','مینہ']),

('2026-10-19',
 'After the rain I build a bridge of seven colours across the sky, but nobody can ever walk over it. What am I?',
 'بارش کے بعد آسمان پر سات رنگوں کا پل بناؤں، مگر اس پر کوئی چل نہ سکے۔ میں کیا ہوں؟',
 array['It is not built by hands; sunlight makes it.',
       'You see it when the sun comes out while it is still drizzling.',
       'A curved band of colours in the sky: red, yellow, green, blue. It starts with R.'],
 array['ہاتھوں سے نہیں بنتی؛ دھوپ اسے بناتی ہے۔',
       'جب بوندا باندی میں دھوپ نکل آئے تو نظر آتی ہے۔',
       'آسمان پر رنگوں کی ایک کمان: لال، پیلا، ہرا، نیلا۔ پہلا حرف «د» ہے۔'],
 array['rainbow','rainbows','dhanak','qaus e qazah','qauseqazah','qaus qazah','دھنک','قوس قزح','قوسِ قزح']),

('2026-10-20',
 'A great tray full of silver pearls is turned upside down over everyone''s head, yet not one pearl falls. What are they?',
 'موتیوں سے بھرا ایک بڑا تھال سب کے سروں پر الٹا رکھا ہے، مگر ایک موتی بھی نہیں گرتا۔ وہ کیا ہیں؟',
 array['The tray is the night sky.',
       'They twinkle, and the darker the village, the more of them you can see.',
       'Tiny points of light in the night sky. The first letter is S.'],
 array['تھال رات کا آسمان ہے۔',
       'ٹمٹماتے ہیں، اور گاؤں جتنا اندھیرا ہو، اتنے زیادہ دکھائی دیں۔',
       'رات کے آسمان میں روشنی کے ننھے ننھے نقطے۔ پہلا حرف «ت» ہے۔'],
 array['stars','star','tare','taare','taray','tarey','sitare','sitaray','تارے','تارا','ستارے','ستارہ']),

('2026-10-21',
 'I stand in one place all my life, yet I give shade to travellers, fruit to children and a home to birds. What am I?',
 'ساری عمر ایک جگہ کھڑا رہوں، پھر بھی مسافر کو چھاؤں، بچوں کو پھل اور پرندوں کو گھر دوں۔ میں کیا ہوں؟',
 array['It is alive, but it has no legs.',
       'Its roots go into the ground, and people sit under it in the heat.',
       'A tall trunk with branches and leaves, like a banyan or a neem. It starts with T.'],
 array['زندہ ہے، مگر ٹانگیں نہیں۔',
       'اس کی جڑیں زمین میں ہیں، اور گرمی میں لوگ اس کے نیچے بیٹھتے ہیں۔',
       'لمبا تنا، شاخیں اور پتے، جیسے برگد یا نیم۔ پہلا حرف «د» ہے۔'],
 array['tree','trees','darakht','darkht','drakht','ped','درخت','پیڑ','شجر']),

('2026-10-22',
 'Push my long arm up and down, and cool water pours from my mouth, even on the hottest day. What am I?',
 'میرا لمبا بازو اوپر نیچے کرو، تو سخت گرمی میں بھی میرے منہ سے ٹھنڈا پانی نکلے۔ میں کیا ہوں؟',
 array['It stands in a courtyard or beside a village path.',
       'It is made of iron and brings water up from under the ground.',
       'An iron water-drawer you work with a handle, from before taps ran in every home. Two words, and the first starts with H.'],
 array['آنگن میں یا گاؤں کے راستے کے کنارے لگا ہوتا ہے۔',
       'لوہے کا بنا ہوتا ہے اور زمین کے نیچے سے پانی کھینچتا ہے۔',
       'دستے سے چلنے والا لوہے کا پانی نکالنے والا، جب گھروں میں ٹونٹیاں نہیں تھیں۔ پہلا حرف «ن» ہے۔'],
 array['hand pump','handpump','pump','nalka','nalkaa','نلکا','ہینڈ پمپ','ہینڈپمپ']),

('2026-10-23',
 'I am brown and hot, I am poured into cups, and no guest leaves the house without meeting me. What am I?',
 'بھوری اور گرم ہوں، پیالیوں میں ڈالی جاتی ہوں، اور کوئی مہمان مجھ سے ملے بغیر نہیں جاتا۔ میں کیا ہوں؟',
 array['It is something you drink.',
       'It is made with leaves, milk and sugar, boiled together in a pan.',
       'A hot drink with biscuits in the afternoon. Three letters, starting with T.'],
 array['یہ پینے کی چیز ہے۔',
       'پتی، دودھ اور چینی کو ملا کر ابالنے سے بنتی ہے۔',
       'سہ پہر کو بسکٹوں کے ساتھ گرم گرم مشروب۔ پہلا حرف «چ» ہے۔'],
 array['tea','chai','chaye','chaai','cup of tea','doodh patti','چائے','چاۓ','چائ','دودھ پتی']),

('2026-10-24',
 'I am patted between two palms, I sit on a hot iron plate, and when I puff up proudly, I am ready. What am I?',
 'دو ہتھیلیوں کے بیچ تھپکی کھاؤں، گرم لوہے پر بیٹھوں، اور جب پھول جاؤں تو تیار۔ میں کیا ہوں؟',
 array['It is eaten at almost every meal.',
       'It is made from atta dough, rolled out round and flat.',
       'Round flat bread you tear and dip in salan. It starts with R.'],
 array['تقریباً ہر کھانے کے ساتھ کھائی جاتی ہے۔',
       'آٹے کے پیڑے سے بنتی ہے، گول اور چپٹی بیل کر۔',
       'گول چپٹی سی، توڑ کر سالن میں ڈبو کر کھاتے ہیں۔ پہلا حرف «ر» ہے۔'],
 array['roti','rotis','chapati','chapatti','chapathi','phulka','روٹی','روٹیاں','چپاتی','پھلکا']),

('2026-10-25',
 'My face is black and round and it gets fiercely hot every morning, yet I never complain; I only hand out rotis. What am I?',
 'میرا چہرہ کالا اور گول، ہر صبح خوب تپتا ہے، مگر شکایت نہیں کرتا؛ بس روٹیاں بانٹتا ہوں۔ میں کیا ہوں؟',
 array['It is a cooking utensil.',
       'It is made of iron and sits on the stove or over the fire.',
       'A flat, round iron plate for making rotis and parathas. It starts with T.'],
 array['یہ کھانا پکانے کا برتن ہے۔',
       'لوہے کا بنا ہوتا ہے، اور چولہے یا آگ پر رکھا جاتا ہے۔',
       'روٹی اور پراٹھے پکانے کے لیے لوہے کی چپٹی گول پلیٹ۔ پہلا حرف «ت» ہے۔'],
 array['tawa','tava','tawaa','griddle','توا','تووا']),

('2026-10-26',
 'White as jasmine, I come from the buffalo and the cow; boil me and I climb out of the pot the moment you look away. What am I?',
 'چنبیلی جیسا سفید، بھینس اور گائے سے آؤں؛ ابالو اور نظر ہٹاؤ تو دیگچی سے باہر چڑھ جاؤں۔ میں کیا ہوں؟',
 array['It is a drink every child is told to finish.',
       'The gawala brings it in a metal can early in the morning.',
       'A white drink from which yoghurt and butter are made. It starts with M.'],
 array['یہ پینے کی وہ چیز ہے جو ہر بچے کو پوری ختم کرنے کو کہا جاتا ہے۔',
       'گوالا صبح سویرے ڈول میں لے کر آتا ہے۔',
       'سفید مشروب جس سے دہی اور مکھن بنتا ہے۔ پہلا حرف «د» ہے۔'],
 array['milk','doodh','dudh','دودھ']),

('2026-10-27',
 'Thousands of tiny workers build my house and fill it for me; I am golden, thick and sweet, and I never go bad. What am I?',
 'ہزاروں ننھے مزدور میرا گھر بنا کر مجھے بھرتے ہیں؛ سنہرا، گاڑھا اور میٹھا ہوں، اور کبھی خراب نہیں ہوتا۔ میں کیا ہوں؟',
 array['The tiny workers are bees.',
       'It comes from a hive, and people take a spoonful for a sore throat.',
       'A thick golden sweetness made by bees. It starts with H.'],
 array['ننھے مزدور مکھیاں ہیں۔',
       'چھتے سے آتا ہے، اور گلا خراب ہو تو لوگ ایک چمچ کھاتے ہیں۔',
       'مکھیوں کی بنائی ہوئی گاڑھی سنہری مٹھاس۔ پہلا حرف «ش» ہے۔'],
 array['honey','shehad','shahad','shehd','شہد']),

('2026-10-28',
 'On winter nights you crack my thin shell, and two little brothers are hiding inside, wrapped in red blankets. What am I?',
 'سردیوں کی راتوں میں میرا پتلا چھلکا توڑتے ہیں، تو اندر لال کمبل اوڑھے دو ننھے بھائی چھپے ملتے ہیں۔ میں کیا ہوں؟',
 array['It is something to nibble, especially when it is cold.',
       'It is roasted in hot sand and sold from carts in paper cones.',
       'A cheap winter snack in a crinkly shell. It starts with P.'],
 array['یہ ٹونگنے کی چیز ہے، خاص طور پر ٹھنڈ میں۔',
       'گرم ریت میں بھونی جاتی ہے اور ریڑھیوں پر کاغذ کے لفافوں میں بکتی ہے۔',
       'جھری دار چھلکے میں سردیوں کی سستی سوغات۔ پہلا حرف «م» ہے۔'],
 array['peanut','peanuts','groundnut','groundnuts','moongphali','mungphali','moong phali','مونگ پھلی','مونگپھلی']),

('2026-10-29',
 'I stand in the field in a green shawl with golden hair on my head; peel the shawl away and rows of pearls shine underneath. What am I?',
 'کھیت میں ہری چادر اوڑھے کھڑی ہوں، سر پر سنہرے بال؛ چادر ہٹاؤ تو نیچے موتیوں کی قطاریں چمکیں۔ میں کیا ہوں؟',
 array['The pearls are yellow, and you can eat them.',
       'In the rainy season it is roasted on coals by the roadside and rubbed with lemon and salt.',
       'A cob packed with yellow kernels, roasted and sold as a snack. It starts with C.'],
 array['موتی پیلے ہیں، اور کھائے جاتے ہیں۔',
       'برسات میں سڑک کنارے کوئلوں پر بھونا جاتا ہے اور لیموں نمک لگا کر بکتا ہے۔',
       'پیلے دانوں سے بھری بالی، بھون کر کھائی جاتی ہے۔ پہلا حرف «ب» ہے۔'],
 array['corn','corn cob','corncob','maize','bhutta','butta','challi','makai','makki','بھٹا','بھٹہ','چھلی','مکئی','مکی']),

('2026-10-30',
 'I am tall and knotted like bamboo, but chew me or press me and I give you nothing but sweetness. What am I?',
 'بانس کی طرح لمبا اور گانٹھ دار ہوں، مگر چباؤ یا نچوڑو تو صرف مٹھاس دوں۔ میں کیا ہوں؟',
 array['It grows in the fields of Punjab and Sindh.',
       'Its juice is pressed out by a machine at roadside stalls, with ginger and lemon.',
       'The tall plant that gur and sugar are made from. It starts with S.'],
 array['پنجاب اور سندھ کے کھیتوں میں اگتا ہے۔',
       'سڑک کنارے ٹھیلوں پر مشین سے اس کا رس نکالا جاتا ہے، ادرک اور لیموں کے ساتھ۔',
       'وہ لمبا پودا جس سے گڑ اور چینی بنتی ہے۔ پہلا حرف «گ» ہے۔'],
 array['sugarcane','sugar cane','ganna','gunna','ganaa','گنا','گنّا','گنے']),

('2026-10-31',
 'I live in a house guarded by thirty-two white soldiers; I have no bones, yet I can hurt a heart or comfort it. What am I?',
 'بتیس سفید پہرے داروں کے گھر میں رہتی ہوں؛ ہڈی کوئی نہیں، پھر بھی دل دکھا بھی سکتی ہوں اور بہلا بھی۔ میں کیا ہوں؟',
 array['The thirty-two soldiers are teeth.',
       'It tastes the salan and helps you speak.',
       'The soft pink part inside your mouth. It starts with T.'],
 array['بتیس سپاہی دانت ہیں۔',
       'سالن کا ذائقہ چکھتی ہے اور بولنے میں مدد کرتی ہے۔',
       'منہ کے اندر کا نرم سا گلابی حصہ۔ پہلا حرف «ز» ہے۔'],
 array['tongue','zaban','zuban','zabaan','زبان','زباں']),

('2026-11-01',
 'I sit on your nose and hold on to your ears, and I help you read the newspaper. What am I?',
 'ناک پر بیٹھوں، کانوں کو پکڑے رہوں، اور اخبار پڑھنے میں مدد کروں۔ میں کیا ہوں؟',
 array['It is worn on the face.',
       'It has two lenses in a frame, and it often goes missing on top of your own head.',
       'You put it on to see clearly. It starts with G.'],
 array['یہ چہرے پر پہنی جاتی ہے۔',
       'فریم میں دو شیشے، اور اکثر اپنے ہی سر پر رکھی رکھی گم ہو جاتی ہے۔',
       'صاف دیکھنے کے لیے لگاتے ہیں۔ پہلا حرف «ع» ہے۔'],
 array['glasses','spectacles','specs','eyeglasses','reading glasses','chashma','chasma','ainak','عینک','چشمہ','چشمے']),

('2026-11-02',
 'I have only one leg, yet I help others walk; on a long walk my friend leans on me, and I never complain. What am I?',
 'میری ایک ہی ٹانگ ہے، پھر بھی دوسروں کو چلنے میں مدد دوں؛ لمبی سیر میں دوست مجھ پر ٹیک لگائے اور میں کبھی شکایت نہ کروں۔ میں کیا ہوں؟',
 array['It is made of wood, bamboo or metal.',
       'It keeps you steady on uneven ground and taps along beside you.',
       'Long and straight with a curved handle, held in one hand as you walk. Two words, and the first starts with W.'],
 array['لکڑی، بانس یا دھات کی بنی ہوتی ہے۔',
       'اونچی نیچی زمین پر سہارا دیتی ہے اور ساتھ ساتھ ٹک ٹک کرتی ہے۔',
       'لمبی سیدھی، مڑے ہوئے دستے والی، چلتے ہوئے ایک ہاتھ میں پکڑتے ہیں۔ پہلا حرف «چ» ہے۔'],
 array['walking stick','walkingstick','stick','cane','lathi','laathi','chhari','chari','چھڑی','لاٹھی','عصا']),

('2026-11-03',
 'I travel from city to city without feet, carrying words from one heart to another, and I arrive in a paper coat. What am I?',
 'بغیر پاؤں شہر شہر جاؤں، ایک دل کی بات دوسرے دل تک پہنچاؤں، اور کاغذ کا لباس پہن کر آؤں۔ میں کیا ہوں؟',
 array['The paper coat is an envelope.',
       'The postman brings it, and you may read it again and again.',
       'A written message sent by post. It starts with L.'],
 array['کاغذ کا لباس لفافہ ہے۔',
       'ڈاکیا لاتا ہے، اور اسے بار بار پڑھا جا سکتا ہے۔',
       'ڈاک سے بھیجا گیا لکھا ہوا پیغام۔ پہلا حرف «خ» ہے۔'],
 array['letter','letters','khat','khatt','chithi','chitthi','خط','چٹھی','مکتوب']),

('2026-11-04',
 'I drink ink and walk on paper, and wherever I go, I leave words behind me. What am I?',
 'سیاہی پیتا ہوں، کاغذ پر چلتا ہوں، اور جہاں جاؤں اپنے پیچھے لفظ چھوڑ جاؤں۔ میں کیا ہوں؟',
 array['It is something you hold between your fingers.',
       'It sits in a shirt pocket or beside a notebook.',
       'You write with it. Three letters, starting with P.'],
 array['یہ انگلیوں کے بیچ پکڑی جانے والی چیز ہے۔',
       'قمیض کی جیب میں یا کاپی کے ساتھ رکھا رہتا ہے۔',
       'اس سے لکھتے ہیں۔ پہلا حرف «ق» ہے۔'],
 array['pen','pens','qalam','kalam','fountain pen','قلم','پین']),

('2026-11-05',
 'Every morning I bring you the news of the whole world, and by evening I am wrapping hot pakoras. What am I?',
 'ہر صبح پوری دنیا کی خبریں لاؤں، اور شام تک گرم پکوڑے لپیٹوں۔ میں کیا ہوں؟',
 array['It is read once, and then it is used for everything else.',
       'A hawker throws it over the gate before breakfast.',
       'Folded sheets of printed news that come out every day. It starts with N.'],
 array['اسے ایک بار پڑھا جاتا ہے، پھر ہر دوسرے کام میں آتا ہے۔',
       'ہاکر ناشتے سے پہلے گیٹ پر پھینک جاتا ہے۔',
       'روز چھپنے والی خبروں کے تہہ کیے ہوئے ورق۔ پہلا حرف «ا» ہے۔'],
 array['newspaper','newspapers','news paper','paper','akhbar','akhbaar','اخبار','اخبارات']),

('2026-11-06',
 'I dance across the floor every morning, and wherever I dance, the dust runs away. What am I?',
 'ہر صبح فرش پر ناچوں، اور جہاں ناچوں وہاں سے مٹی بھاگ جائے۔ میں کیا ہوں؟',
 array['It is used for cleaning.',
       'It is a bundle of dry grass or thin sticks tied together at one end.',
       'You sweep the courtyard with it. It starts with B.'],
 array['صفائی کے کام آتی ہے۔',
       'سوکھی گھاس یا تیلیوں کا گٹھا جو ایک سرے سے بندھا ہو۔',
       'اس سے آنگن صاف کرتے ہیں۔ پہلا حرف «ج» ہے۔'],
 array['broom','jharu','jharoo','jhaaru','jhadu','jhaadu','جھاڑو']);

insert into public.daily_puzzles
  (puzzle_date, riddle_en, riddle_ur, hint_en, hint_ur, hints_en, hints_ur)
select d, r_en, r_ur, h_en[2], h_ur[2], h_en, h_ur
from riddle_src
on conflict (puzzle_date) do update
set riddle_en = excluded.riddle_en,
    riddle_ur = excluded.riddle_ur,
    hint_en   = excluded.hint_en,
    hint_ur   = excluded.hint_ur,
    hints_en  = excluded.hints_en,
    hints_ur  = excluded.hints_ur;

insert into public.daily_puzzle_answers (puzzle_date, answers)
select d, answers
from riddle_src
on conflict (puzzle_date) do update
set answers = excluded.answers;

drop table riddle_src;

/* ─── part 3 of 3: 2026-11-07 … 2026-11-26 ─── */

drop table if exists pg_temp.riddle_src;
create temp table riddle_src (
  d        date primary key,
  r_en     text   not null,
  r_ur     text   not null,
  h_en     text[] not null,
  h_ur     text[] not null,
  answers  text[] not null
);

insert into riddle_src (d, r_en, r_ur, h_en, h_ur, answers) values

('2026-11-07',
 'It costs nothing and weighs nothing, yet when you give it away, it usually comes straight back to you. What is it?',
 'نہ اس کی قیمت، نہ وزن، پھر بھی دے دو تو اکثر فوراً لوٹ آتی ہے۔ وہ کیا ہے؟',
 array['You do not give it with your hands.',
       'It lives on your face, and it shows when you are happy.',
       'Your lips curve upward when you do it. It starts with S.'],
 array['یہ ہاتھ سے نہیں دی جاتی۔',
       'چہرے پر رہتی ہے، اور خوشی میں نظر آتی ہے۔',
       'جب ہونٹ ذرا سے اوپر کو مڑ جائیں۔ پہلا حرف «م» ہے۔'],
 array['smile','a smile','smiles','muskurahat','muskaan','muskan','مسکراہٹ','مسکان']),

('2026-11-08',
 'I stand in one place all day, I welcome every guest, and people knock on me before they come in. What am I?',
 'سارا دن ایک جگہ کھڑا رہوں، ہر مہمان کا استقبال کروں، اور لوگ اندر آنے سے پہلے مجھے کھٹکھٹائیں۔ میں کیا ہوں؟',
 array['It is part of every house.',
       'It swings on hinges and has a latch or a lock.',
       'You open it to go in and shut it when you leave. It starts with D.'],
 array['یہ ہر گھر کا حصہ ہے۔',
       'قبضوں پر گھومتا ہے، اور اس میں کنڈی یا تالا ہوتا ہے۔',
       'اندر جانے کو کھولتے ہیں اور جاتے ہوئے بند کرتے ہیں۔ پہلا حرف «د» ہے۔'],
 array['door','doors','darwaza','darwaaza','darvaza','دروازہ','دروازے']),

('2026-11-09',
 'I have many rungs but I never go anywhere; lean me against the wall and I take you up to the roof. What am I?',
 'میرے بہت سے ڈنڈے ہیں مگر خود کہیں نہیں جاتی؛ دیوار سے ٹکا دو تو چھت تک پہنچا دوں۔ میں کیا ہوں؟',
 array['Think of climbing, not of walking.',
       'It is made of wood, bamboo or metal, and it is carried out to reach the roof or a high shelf.',
       'Two long poles with bars between them for climbing. It starts with L.'],
 array['چلنے کا نہیں، چڑھنے کا سوچیں۔',
       'لکڑی، بانس یا لوہے کی ہوتی ہے، چھت یا اونچے طاق تک پہنچنے کو لائی جاتی ہے۔',
       'دو لمبے بانس جن کے بیچ چڑھنے کو ڈنڈے لگے ہوں۔ پہلا حرف «س» ہے۔'],
 array['ladder','ladders','seerhi','sirhi','seedhi','sidhi','سیڑھی','سیڑھیاں','زینہ']),

('2026-11-10',
 'I wear a red crown and wake the whole village before the sun comes up, but I own no clock. What am I?',
 'لال تاج پہنوں، سورج نکلنے سے پہلے سارا گاؤں جگاؤں، مگر میرے پاس کوئی گھڑی نہیں۔ میں کیا ہوں؟',
 array['It is a bird that cannot fly very far.',
       'It lives in the yard beside the coop and pecks at grain.',
       'It crows at dawn, loud and proud. It starts with R.'],
 array['یہ پرندہ ہے جو زیادہ دور اڑ نہیں سکتا۔',
       'صحن میں ڈربے کے پاس رہتا ہے اور دانہ چگتا ہے۔',
       'صبح سویرے ککڑوں کوں کی بانگ دیتا ہے۔ پہلا حرف «م» ہے۔'],
 array['rooster','roosters','cockerel','murgha','murga','murgh','مرغا','مرغ']),

('2026-11-11',
 'I carry heavy loads across hot sand, I can go many days without a drink, and I kneel down so you can climb on. What am I?',
 'گرم ریت پر بھاری بوجھ اٹھاؤں، کئی دن بن پانی رہ لوں، اور سواری کے لیے گھٹنے ٹیک کر بیٹھ جاؤں۔ میں کیا ہوں؟',
 array['It is an animal, and people call it the ship of the desert.',
       'You see it in Thar and Cholistan, and it has a hump on its back.',
       'A tall, long-necked animal that carries people and goods across sand. It starts with C.'],
 array['یہ جانور ہے، اور لوگ اسے ریگستان کا جہاز کہتے ہیں۔',
       'تھر اور چولستان میں ملتا ہے، اور اس کی پیٹھ پر کوہان ہوتا ہے۔',
       'لمبی گردن والا اونچا جانور جو ریت پر لوگوں اور سامان کو لے جاتا ہے۔ پہلا حرف «ا» ہے۔'],
 array['camel','camels','oont','ount','unt','اونٹ','اونٹنی']),

('2026-11-12',
 'When dark clouds gather I spread my tail and dance, and my long feathers are full of shining blue eyes. What am I?',
 'کالی گھٹا چھائے تو دم پھیلا کر ناچوں، اور میرے لمبے پروں میں چمکتی نیلی آنکھیں ہوں۔ میں کیا ہوں؟',
 array['It is a bird.',
       'It is the proudest bird in the garden, and it loves the rainy season.',
       'A big blue-green bird with a tail of spotted feathers. It starts with P.'],
 array['یہ پرندہ ہے۔',
       'باغ کا سب سے نازک مزاج پرندہ، اسے برسات بہت پسند ہے۔',
       'بڑا نیلا ہرا پرندہ، دم میں چتی دار پر۔ پہلا حرف «م» ہے۔'],
 array['peacock','peacocks','peafowl','mor','مور','مورنی']),

('2026-11-13',
 'I carry my house on my back wherever I go and I never hurry, yet in the old story I won the race. What am I?',
 'جہاں جاؤں اپنا گھر پیٹھ پر اٹھائے جاؤں، کبھی جلدی نہ کروں، پھر بھی پرانی کہانی میں دوڑ جیت گیا۔ میں کیا ہوں؟',
 array['The old story is the one with the hare.',
       'It is an animal with a hard shell, and it can pull its head inside.',
       'A slow animal with a domed shell that lives a very long time. It starts with T.'],
 array['پرانی کہانی وہی جس میں خرگوش تھا۔',
       'سخت خول والا جانور جو اپنا سر اندر کھینچ لیتا ہے۔',
       'دھیرے چلنے والا جانور، پیٹھ پر گنبد جیسا خول، بہت لمبی عمر پاتا ہے۔ پہلا حرف «ک» ہے۔'],
 array['tortoise','tortoises','turtle','turtles','kachhua','kachua','kachwa','کچھوا','کچھوے']),

('2026-11-14',
 'I am made from green leaves, yet I paint hands red; before every Eid and every wedding, everyone waits for me. What am I?',
 'ہرے پتوں سے بنتی ہوں، مگر ہاتھوں کو لال رنگ دیتی ہوں؛ ہر عید اور شادی سے پہلے سب میری راہ دیکھیں۔ میں کیا ہوں؟',
 array['It is put on the hands, not worn on the body.',
       'It is piped from a cone in flowers and vines, and a whole night before a wedding is named after it.',
       'A green paste that dries and leaves a red-brown pattern on the skin. It starts with H.'],
 array['یہ ہاتھوں پر لگتی ہے، جسم پر پہنی نہیں جاتی۔',
       'باریک کون سے پھول بوٹے بنا کر لگائی جاتی ہے، اور شادی سے پہلے اس کے نام کی ایک پوری رات ہوتی ہے۔',
       'ہرا لیپ جو سوکھ کر ہاتھ پر لال بھورا نقش چھوڑ جاتا ہے۔ پہلا حرف «م» ہے۔'],
 array['henna','mehndi','mehendi','mehandi','menhdi','مہندی','حنا']),

('2026-11-15',
 'We are round rings of glass that sing on the wrist, and on Chand Raat people queue to buy us in every colour. What are we?',
 'ہم کانچ کے گول چھلے ہیں جو کلائی پر گنگنائیں، اور چاند رات کو ہر رنگ میں ہمیں خریدنے کی قطار لگے۔ ہم کیا ہیں؟',
 array['They are worn in sets, not one at a time.',
       'They are made of glass or gold, and they tinkle when you move your hands.',
       'Round rings slipped over the hand onto the wrist. It starts with B.'],
 array['یہ ایک ایک نہیں، سیٹ میں پہنی جاتی ہیں۔',
       'کانچ یا سونے کی بنی، ہاتھ ہلاؤ تو کھنکتی ہیں۔',
       'گول کڑے جو ہاتھ سے گزار کر کلائی میں پہنے جاتے ہیں۔ پہلا حرف «چ» ہے۔'],
 array['bangles','bangle','churiyan','chooriyan','choorian','churian','churi','choori','چوڑیاں','چوڑی']),

('2026-11-16',
 'In the monsoon I hang from the branch of a tree; I go forward and back, forward and back, but I never arrive anywhere. What am I?',
 'ساون میں درخت کی شاخ سے لٹکوں؛ آگے پیچھے، آگے پیچھے جاؤں، مگر کہیں نہ پہنچوں۔ میں کیا ہوں؟',
 array['Children love it, and so do grown-ups when nobody is looking.',
       'It is made of two ropes and a plank, and someone gives you a push.',
       'You sit on it and fly back and forth. It starts with S.'],
 array['بچوں کو بہت پسند ہے، اور بڑوں کو بھی جب کوئی دیکھ نہ رہا ہو۔',
       'دو رسیاں اور ایک تختہ، اور کوئی پیچھے سے دھکا دیتا ہے۔',
       'اس پر بیٹھ کر آگے پیچھے اڑتے ہیں۔ پہلا حرف «ج» ہے۔'],
 array['swing','swings','jhoola','jhula','jhoolaa','peeng','pengh','جھولا','جھولے','پینگ']),

('2026-11-17',
 'I am made with two long needles and a ball of wool, and all winter long I give you a warm hug. What am I?',
 'دو لمبی سلائیوں اور اون کے گولے سے بنتا ہوں، اور ساری سردی آپ کو گرم جپھی دیتا ہوں۔ میں کیا ہوں؟',
 array['It is something you wear.',
       'It is knitted, and you pull it on over your shirt when November turns cold.',
       'A warm woollen top with long sleeves. It starts with S.'],
 array['یہ پہننے کی چیز ہے۔',
       'بنا جاتا ہے، اور نومبر میں ٹھنڈ ہو تو قمیض کے اوپر پہنتے ہیں۔',
       'لمبی آستینوں والا اونی گرم کپڑا۔ پہلا حرف «س» ہے۔'],
 array['sweater','sweaters','swetar','jersey','jumper','cardigan','pullover','سویٹر','سوئٹر','جرسی']),

('2026-11-18',
 'I am twisted round and round with no beginning and no end; I am fried golden, and then I swim in syrup. What am I?',
 'گول گول بل کھائی ہوں، نہ سرا نہ آخر؛ سنہری تلی جاؤں اور پھر شیرے میں تیروں۔ میں کیا ہوں؟',
 array['It is a sweet.',
       'The halwai makes it fresh in a big karahi, and it is eaten hot in winter, sometimes with milk.',
       'A crisp, sticky, orange spiral of sweetness. It starts with J.'],
 array['یہ مٹھائی ہے۔',
       'حلوائی بڑی کڑاہی میں تازہ بناتا ہے، سردیوں میں گرم گرم کھائی جاتی ہے، کبھی دودھ کے ساتھ۔',
       'نارنجی، کرکری، چپچپی مٹھاس کا چکر۔ پہلا حرف «ج» ہے۔'],
 array['jalebi','jalebis','jalaibi','jilebi','jalebee','jilabi','جلیبی','جلیبیاں']),

('2026-11-19',
 'When my belly gets hot I start to whistle, and steam comes out of my long nose. What am I?',
 'پیٹ گرم ہو تو سیٹی بجانے لگوں، اور میری لمبی ناک سے بھاپ نکلے۔ میں کیا ہوں؟',
 array['It lives in the kitchen.',
       'Water is boiled in it, often for the afternoon cup.',
       'A metal pot with a spout, a lid and a handle, for boiling water. It starts with K.'],
 array['یہ باورچی خانے میں رہتی ہے۔',
       'اس میں پانی ابالا جاتا ہے، اکثر شام کی پیالی کے لیے۔',
       'دھات کا برتن، ٹونٹی، ڈھکن اور دستے کے ساتھ، پانی ابالنے کو۔ پہلا حرف «ک» ہے۔'],
 array['kettle','kettles','ketli','kaitli','kitli','کیتلی']),

('2026-11-20',
 'I have a thin body and a small red head; rub my head and I burst into flame, and then my work is done. What am I?',
 'پتلا سا جسم، ننھا سا لال سر؛ سر رگڑو تو شعلہ بن جاؤں، اور پھر میرا کام ختم۔ میں کیا ہوں؟',
 array['Many of them live together in one small box.',
       'You take one out to light the stove or a candle.',
       'A tiny wooden stick with a red tip that you strike on the side of its box. It starts with M.'],
 array['ان میں سے بہت سی ایک چھوٹی سی ڈبیا میں رہتی ہیں۔',
       'چولہا یا موم بتی جلانے کو ایک نکالتے ہیں۔',
       'لکڑی کی ننھی سی سلائی، سرے پر لال مسالہ، ڈبیا کے کنارے پر رگڑتے ہیں۔ پہلا حرف «م» ہے۔'],
 array['matchstick','matchsticks','match','matches','matchbox','tili','teeli','machis','maachis','ماچس','تیلی','دیاسلائی']),

('2026-11-21',
 'Green mangoes are put to sleep in a jar of oil and spices, and a month later they wake up sour and delicious. What are they now?',
 'کچے آم تیل اور مصالحے کے مرتبان میں سلا دیے جاتے ہیں، اور مہینے بعد کھٹے اور مزیدار ہو کر جاگتے ہیں۔ اب وہ کیا ہیں؟',
 array['It is eaten a little at a time, beside the main food.',
       'The jar is left in the sun on the roof, and it can be made from lemons, carrots or chillies too.',
       'A sour, spicy relish in oil, eaten with daal and roti. It starts with P.'],
 array['تھوڑا سا، اصل کھانے کے ساتھ کھایا جاتا ہے۔',
       'مرتبان چھت پر دھوپ میں رکھا جاتا ہے، اور لیموں، گاجر یا مرچ کا بھی بنتا ہے۔',
       'تیل میں ڈوبا کھٹا، چٹپٹا ذائقہ، دال روٹی کے ساتھ۔ پہلا حرف «ا» ہے۔'],
 array['pickle','pickles','achar','achaar','aachar','اچار']),

('2026-11-22',
 'Call out in the hills or down a deep well, and I answer you with your very own words, though I have no mouth. What am I?',
 'پہاڑوں میں یا گہرے کنویں میں آواز دو، تو میں آپ ہی کے لفظ لوٹا دوں، حالانکہ میرا منہ نہیں۔ میں کیا ہوں؟',
 array['It is a sound, not a creature.',
       'It happens in valleys, empty halls and wells.',
       'Your own voice coming back to you. Four letters, starting with E.'],
 array['یہ آواز ہے، کوئی جاندار نہیں۔',
       'وادیوں، خالی ہالوں اور کنوؤں میں ہوتی ہے۔',
       'آپ کی اپنی آواز جو لوٹ کر آئے۔ پہلا حرف «گ» ہے۔'],
 array['echo','echoes','goonj','gunj','گونج','بازگشت']),

('2026-11-23',
 'Every morning I scatter pearls on the grass, and by the time the sun climbs high, every pearl is gone. What am I?',
 'ہر صبح گھاس پر موتی بکھیروں، اور سورج اونچا ہو تو ایک موتی بھی نہ بچے۔ میں کیا ہوں؟',
 array['The pearls are made of water.',
       'It forms overnight when autumn and winter mornings are cool.',
       'Tiny drops of water on leaves at dawn. It starts with D.'],
 array['موتی پانی کے ہیں۔',
       'خزاں اور سردیوں کی ٹھنڈی راتوں میں بن جاتی ہے۔',
       'صبح سویرے پتوں پر پانی کے ننھے قطرے۔ پہلا حرف «ش» ہے۔'],
 array['dew','dewdrops','dew drops','shabnam','os','oos','شبنم','اوس']),

('2026-11-24',
 'My body is hollow and full of holes, but blow gently across me and I sing sweeter than a bird. What am I?',
 'میرا جسم کھوکھلا اور سوراخوں سے بھرا، مگر ہلکی سی پھونک مارو تو چڑیا سے میٹھا گاؤں۔ میں کیا ہوں؟',
 array['It is a musical instrument.',
       'It is made of bamboo, and shepherds play it in the old folk tales.',
       'A thin pipe you blow into while your fingers cover the holes. It starts with F.'],
 array['یہ ایک ساز ہے۔',
       'بانس سے بنتی ہے، اور پرانے قصوں میں چرواہے اسے بجاتے ہیں۔',
       'پتلی سی نلکی جس میں پھونکتے ہیں اور انگلیوں سے سوراخ بند کرتے ہیں۔ پہلا حرف «ب» ہے۔'],
 array['flute','flutes','bansuri','bansri','baansuri','بانسری','بانسلی']),

('2026-11-25',
 'I grow upside down with my green hair above the ground, and in winter I am grated and cooked slowly into a famous halwa. What am I?',
 'الٹی اگتی ہوں، ہرے بال زمین کے اوپر؛ سردیوں میں کدوکش ہو کر آہستہ آہستہ ایک مشہور حلوہ بن جاتی ہوں۔ میں کیا ہوں؟',
 array['It is a vegetable, and rabbits love it.',
       'In Pakistani winters it is sold red and fresh, and its juice is sweet.',
       'A long, pointed, red or orange root. It starts with C.'],
 array['یہ سبزی ہے، اور خرگوش کو بہت پسند ہے۔',
       'سردیوں میں لال لال بکتی ہے، اور اس کا رس میٹھا ہوتا ہے۔',
       'لمبی، نوکیلی، لال یا نارنجی جڑ۔ پہلا حرف «گ» ہے۔'],
 array['carrot','carrots','gajar','gajjar','گاجر','گاجریں']),

('2026-11-26',
 'In me, old friends never grow older, the wedding day never ends, and the children stay small for ever. What am I?',
 'مجھ میں پرانے دوست کبھی بڑے نہیں ہوتے، شادی کا دن کبھی ختم نہیں ہوتا، اور بچے ہمیشہ چھوٹے رہتے ہیں۔ میں کیا ہوں؟',
 array['It holds one moment still.',
       'It is kept in an album, in a frame on the wall, or in a wallet.',
       'An image taken with a camera and printed on paper. It starts with P.'],
 array['یہ ایک لمحے کو تھام لیتی ہے۔',
       'البم میں، دیوار پر فریم میں، یا بٹوے میں رکھی جاتی ہے۔',
       'کیمرے سے کھینچی اور کاغذ پر چھاپی گئی۔ پہلا حرف «ت» ہے۔'],
 array['photograph','photographs','photo','photos','picture','pictures','tasveer','tasvir','tasweer','تصویر','تصویریں','فوٹو']);

insert into public.daily_puzzles
  (puzzle_date, riddle_en, riddle_ur, hint_en, hint_ur, hints_en, hints_ur)
select d, r_en, r_ur, h_en[2], h_ur[2], h_en, h_ur
from riddle_src
on conflict (puzzle_date) do update
set riddle_en = excluded.riddle_en,
    riddle_ur = excluded.riddle_ur,
    hint_en   = excluded.hint_en,
    hint_ur   = excluded.hint_ur,
    hints_en  = excluded.hints_en,
    hints_ur  = excluded.hints_ur;

insert into public.daily_puzzle_answers (puzzle_date, answers)
select d, answers
from riddle_src
on conflict (puzzle_date) do update
set answers = excluded.answers;

drop table riddle_src;
