// The دلال's file, written as fragments that combine into one spoken Saudi sentence, plus whole hand-written lines.
//
// Car classes (`cls`): top (exotic), lux (luxury), sport, classic, work (pickups, vans, work tier), fam (family tier),
// daily (daily tier), junk. A fragment without `cls` fits every class.
// Tags (`g`, all must hold; `!x` negates):
//   hi / lo     km above 180,000 / under 80,000        old / new   10+ years / 4 years or less
//   lux / eco   luxury, sport or exotic tier / other   work        pickup, van or work tier
//   fam         suv, van or sedan                      x4          4WD or AWD
//   own         private seller                         co          company, rental or government seller
//   rent / cmp / gov   that one seller                  o1 / o2     one owner / two or more
//   d4          four doors                             n15         15 years old or less
//   k1 / k2     one key / two keys                      clean       no touched panel and no Najm accident
//   dealer      serviced at the dealer                  comp        comprehensive insurance
//   small       sedan, hatch, coupe or convertible        tall   suv, pickup or van
// `q` is how much the car is used: R (rarely) or D (daily and hard). An owner and a use line never disagree.
// `k` is a topic; one car's file says one thing per topic (no «ما يدخّن فيها» next to «ريحة سجاير»).

export type Cls = 'top' | 'lux' | 'sport' | 'classic' | 'work' | 'fam' | 'daily' | 'junk';
export type Role = 'rich' | 'young' | 'fam' | 'pro' | 'trade' | 'old' | 'group' | 'fleet';

export interface Frag {
  id: string;
  t: string;
  g?: string;
  cls?: Cls[];
  q?: 'R' | 'D';
  k?: string;
}
export interface Persona extends Frag {
  role: Role;
}
export interface Habit extends Frag {
  /** roles this clause suits; a habit with a person subject never goes to a fleet or a family group */
  who: Role[];
  /** personas it contradicts */
  not?: string[];
}
/** a place phrase: B between two places, R a road, I inside town, O out of town */
export interface Route extends Frag {
  kind: 'B' | 'R' | 'I' | 'O';
  who?: Role[];
  /** personas it suits best (drawn more often with them) */
  like?: string[];
  /** personas it is only for */
  only?: string[];
}
export interface Frame extends Frag {
  /** route kinds the frame reads well with; `{w}` is where the route goes */
  kinds: ('B' | 'R' | 'I' | 'O')[];
  /** frames that speak of «صاحبها» need a person owner */
  person?: boolean;
  group?: boolean;
  /** owner roles the frame suits (a working rhythm is not a retired man's) */
  roles?: Role[];
}
export interface Cause extends Frag {
  cat: string;
}
export interface Need extends Frag {
  cat: string;
}
export interface Thing {
  id: string;
  /** each state is one sentence ({side} {door} {win} {boot} are filled per car), alone or with its own tags */
  s: (string | [string, string])[];
  g?: string;
  cls?: Cls[];
  k?: string;
}
export interface Whole {
  t: string;
  g?: string;
  cls?: Cls[];
  q?: 'R' | 'D';
  k?: string;
}

const RICH: Cls[] = ['top', 'lux', 'sport', 'classic'];
const ALLP: Role[] = ['rich', 'young', 'fam', 'pro', 'trade', 'old'];

// ---------------------------------------------------------------- owner: who had it

/** a person persona reads after «كانت عند» / «صاحبها» / «عند» / «كانت مع» */
export const PERSONAS: Persona[] = [
  // people who can own an exotic or a luxury car
  { id: 'collector', t: 'هاوي يجمع سيارات', role: 'rich', cls: ['top', 'sport', 'classic', 'lux'] },
  { id: 'biz', t: 'رجل أعمال', role: 'rich', cls: ['top', 'lux'] },
  { id: 'heir', t: 'وريث ما ساقها إلا مرات تنعد', role: 'rich', cls: ['top', 'lux', 'sport', 'classic'], g: 'lo', q: 'R' },
  { id: 'builder', t: 'صاحب شركة مقاولات', role: 'rich', cls: ['top', 'lux'] },
  { id: 'surgeon', t: 'استشاري جراحة', role: 'rich', cls: ['lux', 'sport', 'top', 'fam'] },
  { id: 'estate', t: 'تاجر عقار', role: 'rich', cls: ['top', 'lux', 'fam'] },
  { id: 'dealer', t: 'صاحب معرض سيارات', role: 'rich', cls: ['top', 'lux', 'sport', 'classic'] },
  { id: 'watches', t: 'واحد يجمع ساعات', role: 'rich', cls: ['lux', 'top', 'sport'] },
  { id: 'ceo', t: 'مدير تنفيذي في شركة كبيرة', role: 'rich', cls: ['lux', 'top'] },
  { id: 'horses', t: 'صاحب إسطبل خيل', role: 'rich', cls: ['lux', 'top', 'work'], g: 'tall' },
  { id: 'trackday', t: 'شاب يحضر أيام الحلبة', role: 'rich', cls: ['sport', 'top'] },
  { id: 'investor', t: 'مستثمر يسافر أكثر مما يقعد', role: 'rich', cls: ['top', 'lux'], q: 'R' },
  { id: 'gold', t: 'تاجر ذهب', role: 'rich', cls: ['lux', 'top'] },
  { id: 'captain', t: 'كابتن طيار', role: 'rich', cls: ['lux', 'sport', 'fam'] },
  { id: 'dentist', t: 'طبيب أسنان عنده عيادته', role: 'rich', cls: ['lux', 'sport', 'fam'] },
  { id: 'camels', t: 'صاحب حلال وإبل', role: 'trade', cls: ['work', 'lux', 'fam'], g: 'x4 tall' },
  { id: 'restorer', t: 'واحد يرمم السيارات القديمة', role: 'rich', cls: ['classic'] },
  { id: 'lawyer', t: 'محامي له مكتبه', role: 'rich', cls: ['lux', 'top', 'sport', 'fam'] },
  { id: 'factory', t: 'صاحب مصنع', role: 'rich', cls: ['lux', 'top'] },
  { id: 'chain', t: 'صاحب سلسلة مطاعم', role: 'rich', cls: ['lux', 'top', 'sport'] },
  { id: 'cartrader', t: 'تاجر سيارات', role: 'rich', cls: ['lux', 'top', 'sport', 'classic'] },
  { id: 'bankmgr', t: 'مدير بنك', role: 'rich', cls: ['lux', 'fam'] },
  { id: 'travel', t: 'صاحب شركة سفريات', role: 'rich', cls: ['lux', 'top'] },
  { id: 'mall', t: 'صاحب مجمّع تجاري', role: 'rich', cls: ['lux', 'top'] },
  { id: 'consultant', t: 'مهندس استشاري له مكتبه', role: 'rich', cls: ['lux', 'fam', 'sport'] },
  { id: 'oudtrader', t: 'تاجر عطور وعود', role: 'rich', cls: ['lux', 'top'], k: 'smell' },
  { id: 'stations', t: 'صاحب محطات بنزين', role: 'rich', cls: ['lux', 'top', 'work'] },
  { id: 'hotel', t: 'صاحب فندق', role: 'rich', cls: ['lux', 'top'] },
  { id: 'explayer', t: 'لاعب كرة معتزل', role: 'rich', cls: ['lux', 'top', 'sport'] },
  { id: 'youngbiz', t: 'رجل أعمال شاب', role: 'rich', cls: ['top', 'sport', 'lux'] },
  { id: 'livestock', t: 'تاجر مواشي', role: 'rich', cls: ['lux', 'work'], g: 'x4 tall' },
  { id: 'tech', t: 'صاحب شركة برمجة', role: 'rich', cls: ['sport', 'lux', 'top'] },
  { id: 'professor', t: 'دكتور في الجامعة', role: 'rich', cls: ['lux', 'fam'] },
  { id: 'exceo', t: 'مدير شركة متقاعد', role: 'old', cls: ['lux', 'top', 'classic'] },
  { id: 'surgeon2', t: 'طبيب تجميل له عيادته', role: 'rich', cls: ['lux', 'top', 'sport'] },
  { id: 'furniture', t: 'صاحب معرض أثاث', role: 'rich', cls: ['lux', 'fam'] },
  { id: 'catering', t: 'صاحب شركة تموين', role: 'rich', cls: ['lux', 'work'] },
  { id: 'counsel', t: 'مستشار قانوني', role: 'rich', cls: ['lux', 'sport'] },
  { id: 'farms', t: 'صاحب مزارع كبيرة', role: 'rich', cls: ['lux', 'work', 'top'], g: 'x4 tall' },
  { id: 'transportco', t: 'صاحب شركة نقل', role: 'rich', cls: ['lux', 'top'] },
  // young
  { id: 'firstjob', t: 'شاب في أول وظيفة', role: 'young', cls: ['daily', 'junk', 'fam'] },
  { id: 'student', t: 'طالب جامعة', role: 'young', cls: ['daily', 'junk'] },
  { id: 'modder', t: 'شاب يحب التعديل', role: 'young', cls: ['daily', 'sport', 'junk', 'classic'] },
  { id: 'returnee', t: 'مبتعث توه راجع', role: 'young', cls: ['daily', 'fam', 'sport'] },
  { id: 'footballer', t: 'لاعب في نادي درجة أولى', role: 'young', cls: ['sport', 'lux', 'daily'] },
  { id: 'carphoto', t: 'شاب يصوّر السيارات لحسابه', role: 'young', cls: ['sport', 'top', 'lux'] },
  // fathers
  { id: 'abuiyal', t: 'أبو عيال', role: 'fam', cls: ['fam', 'daily'] },
  { id: 'twins', t: 'أب عنده توأم', role: 'fam', cls: ['fam', 'daily'] },
  { id: 'bigfam', t: 'معلم عنده خمسة عيال', role: 'fam', cls: ['fam', 'daily'] },
  { id: 'newdad', t: 'أب توه متزوج', role: 'fam', cls: ['fam', 'daily', 'sport'] },
  // salaried
  { id: 'bank', t: 'موظف بنك', role: 'pro', cls: ['daily', 'fam'] },
  { id: 'oil', t: 'مهندس في شركة بترول', role: 'pro', cls: ['fam', 'daily', 'lux'] },
  { id: 'doctor', t: 'طبيب مناوب', role: 'pro', cls: ['daily', 'fam', 'lux'] },
  { id: 'nurse', t: 'ممرض', role: 'pro', cls: ['daily', 'fam'] },
  { id: 'maths', t: 'مدرس رياضيات', role: 'pro', cls: ['daily', 'fam', 'junk', 'classic'] },
  { id: 'accountant', t: 'محاسب', role: 'pro', cls: ['daily', 'fam'] },
  { id: 'civil', t: 'موظف حكومي', role: 'pro', cls: ['daily', 'fam', 'junk'] },
  { id: 'telecom', t: 'مهندس اتصالات', role: 'pro', cls: ['daily', 'fam', 'work'] },
  { id: 'soldier', t: 'عسكري', role: 'pro', cls: ['daily', 'fam', 'work'] },
  { id: 'sales', t: 'مندوب مبيعات', role: 'pro', cls: ['daily', 'fam'], g: '!lo' },
  { id: 'mouaqqib', t: 'معقّب', role: 'pro', cls: ['daily', 'fam', 'junk'] },
  { id: 'wedding', t: 'مصوّر أعراس', role: 'pro', cls: ['daily', 'fam', 'work'] },
  { id: 'airport', t: 'موظف في المطار', role: 'pro', cls: ['daily', 'fam'] },
  // trades
  { id: 'smallbuild', t: 'مقاول صغير', role: 'trade', cls: ['work', 'junk'] },
  { id: 'palms', t: 'صاحب مزرعة نخل', role: 'trade', cls: ['work', 'fam', 'classic', 'junk'] },
  { id: 'actech', t: 'فني تكييف', role: 'trade', cls: ['work', 'daily', 'junk'] },
  { id: 'garage', t: 'صاحب ورشة', role: 'trade', cls: ['work', 'daily', 'junk', 'classic', 'sport'] },
  { id: 'plumber', t: 'سبّاك شغّال لحسابه', role: 'trade', cls: ['work', 'junk', 'daily'] },
  { id: 'parts', t: 'صاحب محل قطع غيار', role: 'trade', cls: ['work', 'daily', 'fam', 'junk'] },
  { id: 'restaurant', t: 'صاحب مطعم', role: 'trade', cls: ['work', 'fam', 'daily'] },
  { id: 'site', t: 'مهندس موقع', role: 'trade', cls: ['work', 'fam', 'daily'] },
  { id: 'nursery', t: 'صاحب مشتل', role: 'trade', cls: ['work', 'junk'] },
  { id: 'carpenter', t: 'نجّار', role: 'trade', cls: ['work', 'junk'] },
  // older men
  { id: 'retired', t: 'معلم متقاعد', role: 'old', cls: ['daily', 'fam', 'classic', 'junk'] },
  { id: 'shayeb', t: 'شايب متقاعد', role: 'old', cls: ['classic', 'daily', 'fam', 'junk', 'lux'] },
  { id: 'officer', t: 'ضابط متقاعد', role: 'old', cls: ['lux', 'fam', 'classic', 'daily'] },
  { id: 'grandpa', t: 'جدّ عنده أحفاد كثير', role: 'old', cls: ['fam', 'daily', 'classic'] },
  // a household (only «كانت عند» / «عند»)
  { id: 'household', t: 'عائلة كبيرة', role: 'group', cls: ['daily', 'fam', 'classic', 'junk'] },
  { id: 'brothers', t: 'ثلاث إخوان يتقاسمونها', role: 'group', cls: ['daily', 'junk', 'fam'] },
];

/** a fleet persona is a whole clause; it goes only to a lot sold by that kind of seller */
export const FLEETS: Persona[] = [
  { id: 'rent_office', t: 'كانت في أسطول مكتب تأجير', role: 'fleet', cls: ['daily', 'fam'], g: 'rent' },
  { id: 'rent_month', t: 'كانت سيارة تأجير شهري', role: 'fleet', cls: ['daily', 'fam', 'work'], g: 'rent' },
  { id: 'rent_lux', t: 'جات من مكتب يأجّر سيارات فخمة', role: 'fleet', cls: ['lux', 'top', 'sport'], g: 'rent' },
  { id: 'rent_airport', t: 'كانت في أسطول تأجير في المطار', role: 'fleet', cls: ['daily', 'fam', 'lux'], g: 'rent' },
  { id: 'cmp_car', t: 'كانت سيارة شركة', role: 'fleet', g: 'cmp' },
  { id: 'cmp_branch', t: 'كانت لمدير فرع في شركة', role: 'fleet', cls: ['lux', 'fam', 'daily'], g: 'cmp' },
  { id: 'cmp_service', t: 'كانت سيارة خدمات لشركة صيانة', role: 'fleet', cls: ['work', 'daily'], g: 'cmp' },
  { id: 'cmp_delivery', t: 'كانت في أسطول شركة توصيل', role: 'fleet', cls: ['work', 'daily'], g: 'cmp' },
  { id: 'cmp_sites', t: 'كانت لشركة مقاولات تدور بين المواقع', role: 'fleet', cls: ['work'], g: 'cmp' },
  { id: 'gov_custody', t: 'كانت عهدة عند جهة حكومية', role: 'fleet', cls: ['daily', 'fam', 'work'], g: 'gov' },
  { id: 'gov_branches', t: 'كانت سيارة جهة حكومية تتنقل بين الفروع', role: 'fleet', cls: ['daily', 'fam'], g: 'gov' },
  { id: 'gov_vip', t: 'كانت لمسؤول في جهة حكومية', role: 'fleet', cls: ['lux', 'fam'], g: 'gov' },
];

/** how he treated the car (never where it went or how often: that is the use line) */
export const HABITS: Habit[] = [
  { id: 'oilearly', t: 'يغيّر الزيت قبل موعده بألف', who: ALLP, k: 'service' },
  { id: 'washfri', t: 'يغسلها كل جمعة بيده', who: ALLP, k: 'wash' },
  { id: 'nooneelse', t: 'ما يرضى أحد يسوقها غيره', who: ['rich', 'young', 'pro', 'old', 'fam'], k: 'driver' },
  { id: 'invoices', t: 'يحفظ فواتيرها في ملف بلاستيك', who: ALLP, k: 'service' },
  { id: 'fuellog', t: 'يكتب كل تفويلة في دفتر صغير', who: ['pro', 'old'], k: 'book' },
  { id: 'warmup', t: 'يدفّيها دقايق قبل كل مشوار', who: ['old', 'pro'] },
  { id: 'nosmoke', t: 'ما يدخّن فيها ولا يخلي أحد يدخّن', who: ALLP, k: 'smell' },
  { id: 'cover', t: 'يغطيها بغطا كل ما وقفت', who: ['rich', 'old', 'pro'], k: 'sun' },
  { id: 'dashwipe', t: 'يمسح الطبلون كل يوم قبل يطلع', who: ['old', 'pro'] },
  { id: 'tyresearly', t: 'يغيّر الكفرات قبل لا تخلص', who: ALLP, k: 'tyre' },
  { id: 'max110', t: 'ما يتعدى 110 أبد', who: ['old', 'pro', 'fam'], k: 'speed' },
  { id: 'dealerdates', t: 'يوديها الوكالة على كل موعد', who: ['rich', 'pro', 'fam'], g: 'dealer', k: 'service' },
  { id: 'fixnow', t: 'أي شي يخرب يصلحه أول بأول', who: ALLP, k: 'service' },
  { id: 'fixlate', t: 'ما يوديها الورشة إلا إذا اشتكت', who: ['young', 'trade'], not: ['garage', 'parts', 'actech'], g: '!dealer', k: 'service' },
  { id: 'overload', t: 'يحمّلها فوق طاقتها أحياناً', who: ['trade'], g: 'work', k: 'boot' },
  { id: 'loud', t: 'يحب صوتها ويدعس على الإشارات', who: ['young', 'rich'], cls: ['sport', 'daily', 'top'], k: 'speed' },
  { id: 'carwash', t: 'يغسلها في المغسلة كل يومين', who: ['rich', 'young'], k: 'wash' },
  { id: 'polish', t: 'يلمّعها قبل أي مناسبة', who: ['rich', 'young', 'fam'], k: 'wash' },
  { id: 'farpark', t: 'يوقف بعيد عن الناس عشان ما ينصدم بابها', who: ['rich', 'old', 'pro'] },
  { id: 'oud', t: 'يبخّرها بعود كل أسبوع', who: ['rich', 'old', 'fam'], k: 'smell' },
  { id: 'noscratch', t: 'ما خلّى عليها خدش', who: ['rich', 'old'], g: 'clean', k: 'paint' },
  { id: 'extras', t: 'يركّب لها كل إضافة تطلع', who: ['young', 'rich'] },
  { id: 'inside', t: 'يهتم بالداخل أكثر من الخارج', who: ALLP },
  { id: 'mvpiearly', t: 'يوديها الفحص قبل موعده بأسبوع', who: ['old', 'pro'] },
  { id: 'amana', t: 'يسوقها بهدوء ويقول السيارة أمانة', who: ['old', 'fam'], k: 'speed' },
  { id: 'lampworkshop', t: 'كل ما ولّعت لمبة راح للورشة', who: ['pro', 'fam', 'old'], k: 'service' },
  { id: 'learners', t: 'علّم عياله السواقة عليها في الحوش', who: ['fam', 'old'], cls: ['daily', 'fam', 'junk'], k: 'kids' },
  { id: 'tools', t: 'يشيل فيها عدته وأغراض الشغل', who: ['trade'], k: 'boot' },
  { id: 'cartons', t: 'يشيل فيها كراتين المحل', who: ['trade'], cls: ['work', 'daily', 'fam', 'junk'], k: 'boot' },
  { id: 'garagekept', t: 'يحطها في كراج مسكّر ويطلّعها للمناسبات', who: ['rich', 'old'], cls: RICH, q: 'R', k: 'sun' },
  { id: 'startdaily', t: 'يشغّلها كل يوم ولو ما مشى فيها', who: ['rich', 'old'], q: 'R' },
  { id: 'guests', t: 'يستقبل فيها ضيوفه من المطار', who: ['rich'], cls: ['lux', 'top'] },
  { id: 'chauffeur', t: 'سواقه يسوقها وهو ورا', who: ['rich'], cls: ['lux', 'top'], g: 'd4', k: 'driver' },
  { id: 'slowmods', t: 'يعدّل فيها شوي شوي', who: ['young'] },
  { id: 'pressure', t: 'يشيّك هوا الكفرات كل ما عبّى بنزين', who: ALLP, k: 'tyre' },
  { id: 'carpool', t: 'يركب معه زملاء الدوام بالدور', who: ['pro'], cls: ['daily', 'fam'] },
  { id: 'frontseat', t: 'عياله يتضاربون على الكرسي اللي قدام', who: ['fam'], k: 'kids' },
  { id: 'mother', t: 'يوصّل فيها الوالدة لمواعيدها', who: ['fam', 'young', 'pro'] },
  { id: 'radio', t: 'يرفع صوت الراديو ويسولف مع نفسه', who: ['young', 'old', 'trade'] },
  { id: 'desertok', t: 'ما يتردد يطلع فيها البر', who: ALLP, g: 'x4', k: 'sand' },
  { id: 'likeason', t: 'يدلّعها مثل ولده', who: ['rich', 'old'] },
  { id: 'scratchpain', t: 'أي خدش فيها كأنه في جسمه', who: ['rich', 'old', 'young'], g: 'clean', k: 'paint' },
  { id: 'fullins', t: 'يأمّن عليها شامل كل سنة', who: ALLP, g: 'comp' },
  { id: 'seatcovers', t: 'كسا الكراسي من أول يوم', who: ALLP, k: 'seat' },
  { id: 'kmcount', t: 'يحسب الكيلوات في كل مشوار', who: ['pro', 'old'] },
  { id: 'halftank', t: 'ما يخليها تنزل عن نص البنزين', who: ALLP },
  { id: 'locktwice', t: 'يقفلها بالريموت مرتين عشان يتطمّن', who: ['old', 'pro'] },
  { id: 'shade', t: 'ما يوقفها إلا في الظل ولو مشى بعدها', who: ['rich', 'pro', 'old'], k: 'sun' },
  { id: 'tidy', t: 'ما تلقى فيها ورقة ولا كيس', who: ['rich', 'pro', 'old'], k: 'mess' },
  // a car subject: for a household or a fleet
  { id: 'eachdriver', t: 'كل سواق يستلمها بطريقته', who: ['fleet'], k: 'driver' },
  { id: 'schedule', t: 'صيانتها على جدول الشركة بالحرف', who: ['fleet'], g: 'dealer', k: 'service' },
  { id: 'dailywash', t: 'تنغسل قبل كل تسليم', who: ['fleet'], g: 'rent', k: 'wash' },
  { id: 'fuelcard', t: 'تعبّي بكرت الشركة', who: ['fleet'], g: '!rent' },
  { id: 'yard', t: 'تنام في حوش الشركة', who: ['fleet'], g: 'cmp', k: 'sun' },
  { id: 'fleetshop', t: 'دخلت ورشة الأسطول أكثر من مرة', who: ['fleet'], k: 'service' },
  { id: 'tracker', t: 'عليها جهاز تتبع من يومها', who: ['fleet'], k: 'tracker' },
  { id: 'handover', t: 'تتسلّم وتنرجع كل أسبوع', who: ['fleet'], g: 'rent', k: 'driver' },
  { id: 'lastdriver', t: 'محد يدري مين آخر واحد ساقها', who: ['fleet'], g: 'rent', k: 'driver' },
  { id: 'renterscent', t: 'كل مستأجر يرجعها بريحة غير', who: ['fleet'], g: 'rent', k: 'smell' },
  { id: 'bykm', t: 'الصيانة على العداد مو على الشكوى', who: ['fleet'], k: 'service' },
  { id: 'logbook', t: 'تنصرف لموظف ويرجعها آخر الدوام', who: ['fleet'], g: '!rent' },
  { id: 'everyone', t: 'كل واحد في البيت ساقها شوي', who: ['group'], k: 'driver' },
  { id: 'nocarer', t: 'ما لها واحد يهتم فيها', who: ['group'], k: 'service' },
  { id: 'eldest', t: 'الكبير يوصي عليها والصغار يسوقونها', who: ['group'], k: 'driver' },
  { id: 'byturn', t: 'كل سنة عند واحد', who: ['group'], g: 'o2', k: 'driver' },
];

/** whole owner lines, kept for their own detail */
export const OWNER_WHOLE: Whole[] = [
  { t: 'عند صاحب محل قطع غيار، يعرف وش يتغيّر قبل لا يخرب', cls: ['work', 'daily', 'fam', 'junk'], k: 'service' },
  { t: 'عند هاوي يغسلها أكثر مما يمشيها', cls: ['sport', 'top', 'classic', 'lux'], q: 'R', k: 'wash' },
  { t: 'عند مقاول صغير، الحوض شال بلك وأسمنت وعفش', cls: ['work'], g: 'work', k: 'boot' },
  { t: 'عند رجل أعمال، السواق يسوقها وهو ورا', cls: ['lux', 'top'], g: 'd4', k: 'driver' },
  { t: 'عند مدرب نادي، الشنطة فيها كور وأقماع دايم', cls: ['daily', 'fam'], k: 'boot' },
  { t: 'عند جدّ يسوقها على 80 ولا يتعداها', cls: ['daily', 'fam', 'classic', 'lux', 'junk'], g: 'old', k: 'speed' },
  { t: 'عند مصوّر، الشنطة كانت استوديو متنقل', cls: ['daily', 'fam', 'work'], k: 'boot' },
  { t: 'كانت هدية تخرّج، وصاحبها سافر بعثة', cls: ['daily', 'sport', 'fam'], g: 'lo', q: 'R' },
  { t: 'كانت عند عائلة كبيرة، كل ولد ساقها سنة', cls: ['daily', 'fam', 'classic', 'junk'], g: 'old o2', k: 'driver' },
  { t: 'عند فني تكييف، الشنطة فيها عدة وأسطوانات', cls: ['work', 'daily'], k: 'boot' },
  { t: 'عند هاوي معارض، تحضر كل تجمّع سيارات', cls: ['sport', 'top', 'classic', 'lux'], q: 'R' },
  { t: 'عند مصمم داخلي، يشيل فيها عيّنات رخام وسيراميك', cls: ['daily', 'fam', 'lux'], k: 'boot' },
  { t: 'عند رجل كبير وقف عن السواقة، وعياله يشغّلونها كل جمعة', cls: ['daily', 'fam', 'lux', 'classic'], g: 'lo', q: 'R' },
  { t: 'عند مالك واحد مرتب، أوراقها كلها في ملف بلاستيك', g: 'own o1', k: 'service' },
  { t: 'عند صياد، الكشافات والحبال كانت عدتها', cls: ['fam', 'work', 'lux'], g: 'x4', k: 'boot' },
  { t: 'جات من مزاد شركة، وملصق الأسطول للحين على الزجاج', cls: ['daily', 'fam', 'work'], g: 'cmp', k: 'sticker' },
  { t: 'عند واحد يجمع ساعات، يدلعها مثل ساعاته', cls: ['lux', 'top', 'sport'] },
  { t: 'عند أب شاب، كرسي الطفل ما فارقها', cls: ['fam', 'daily'], g: 'fam', k: 'kids' },
  { t: 'عند شاب يحب التعديل، بعدين ملّ ورجّعها أصلية', cls: ['daily', 'sport', 'junk'] },
  { t: 'عند خياط يوصّل الطلبات بنفسه', cls: ['daily', 'junk'] },
  { t: 'عند مزارع نخل، موسم الصرام يشيل فيها كراتين', cls: ['work'], g: 'work', k: 'boot' },
  { t: 'عند خطاط، الشنطة فيها لوحات ملفوفة', cls: ['daily', 'fam', 'lux'], k: 'boot' },
  { t: 'عند صاحب ورشة، يصلح فيها اللي يخرب أول بأول', cls: ['daily', 'work', 'junk', 'classic'], k: 'service' },
  { t: 'عند واحد ما يفوّت جلسة بلوت', cls: ['daily', 'fam', 'junk'] },
  { t: 'كانت سيارة البيت الاحتياط، تشتغل لين تخرب الثانية', cls: ['daily', 'fam', 'junk'], g: 'lo', q: 'R' },
  { t: 'عند مدرب سواقة، الفرامل شافت كل أنواع الدعسات', cls: ['daily'], g: 'eco' },
  { t: 'عند مالك ثاني اشتراها من الأول وما طوّلت عنده', g: 'o2' },
  { t: 'عند صاحب إسطبل، تسحب عربة الخيل آخر كل أسبوع', cls: ['work', 'lux', 'fam'], g: 'x4' },
];

// ---------------------------------------------------------------- use: where and how often

export const ROUTES: Route[] = [
  { id: 'commute', t: 'بين البيت والدوام', kind: 'B', who: ['pro', 'fam', 'young', 'trade', 'rich'] },
  { id: 'qassim', t: 'على خط الرياض القصيم', kind: 'R', g: '!lo', like: ['sales', 'mouaqqib'] },
  { id: 'hood', t: 'داخل الحي', kind: 'I', g: '!hi' },
  { id: 'schools', t: 'بين المدارس والبيت', kind: 'B', who: ['fam', 'old', 'group', 'pro'], g: 'fam' },
  { id: 'ring', t: 'على الدائري وقت الزحمة', kind: 'R' },
  { id: 'farmmarket', t: 'بين المزرعة والسوق', kind: 'B', g: 'eco', who: ['trade', 'old', 'fam', 'group'], like: ['palms', 'nursery', 'camels'] },
  { id: 'farmtracks', t: 'في الطرق الترابية حول المزرعة', kind: 'O', g: 'x4 tall', like: ['palms', 'camels', 'horses'], k: 'sand' },
  { id: 'coast', t: 'على طريق الساحل', kind: 'R' },
  { id: 'sites', t: 'بين المواقع والمكتب', kind: 'B', g: 'eco', who: ['trade', 'pro', 'fleet'], like: ['site', 'smallbuild', 'cmp_sites'] },
  { id: 'depots', t: 'بين الفروع والمستودعات', kind: 'B', g: 'eco', who: ['fleet', 'trade'] },
  { id: 'intercity', t: 'على الطريق السريع بين مدينتين', kind: 'R', g: '!lo' },
  { id: 'hospital', t: 'بين البيت والمستشفى', kind: 'B', who: ['pro', 'fam', 'old', 'rich'], like: ['doctor', 'nurse', 'surgeon'] },
  { id: 'citystreets', t: 'في شوارع المدينة', kind: 'I' },
  { id: 'istiraha', t: 'بين البيت والاستراحة', kind: 'B', who: ['young', 'pro', 'trade', 'old', 'fam'] },
  { id: 'south', t: 'على طرق الجنوب الجبلية', kind: 'R' },
  { id: 'north', t: 'على طرق الشمال الطويلة', kind: 'R', g: '!lo' },
  { id: 'airportrun', t: 'بين المطار والفنادق', kind: 'B', who: ['fleet', 'pro'], like: ['rent_airport', 'airport'] },
  { id: 'campus', t: 'بين الجامعة والسكن', kind: 'B', only: ['student'] },
  { id: 'dunes', t: 'في البر والنفود', kind: 'O', g: 'x4 tall', k: 'sand' },
  { id: 'majlis', t: 'بين المجالس والمناسبات', kind: 'B', who: ['rich', 'old', 'fam'] },
  { id: 'beach', t: 'في طلعات البحر والشاليهات', kind: 'O' },
  { id: 'makkah', t: 'على طريق مكة', kind: 'R' },
  { id: 'village', t: 'بين المدينة وبيت الأهل في القرية', kind: 'B', g: '!lux' },
  { id: 'industrial', t: 'داخل المدينة الصناعية', kind: 'I', g: 'eco', who: ['trade', 'fleet'] },
  { id: 'track', t: 'بين الحلبة والكراج', kind: 'B', cls: ['sport', 'top'], who: ['rich', 'young'], like: ['trackday', 'collector'], q: 'R' },
  { id: 'corniche', t: 'على الكورنيش', kind: 'I', cls: ['sport', 'top', 'lux', 'daily'] },
  { id: 'meetings', t: 'بين المكاتب والاجتماعات', kind: 'B', who: ['pro', 'rich', 'fleet'], like: ['ceo', 'cmp_branch', 'gov_vip', 'biz'] },
  { id: 'towers', t: 'بين الأبراج في الطرق الفرعية', kind: 'B', g: 'eco', who: ['pro', 'trade', 'fleet'], like: ['telecom', 'cmp_service'] },
  { id: 'quarries', t: 'بين الكسارات والمشاريع', kind: 'B', cls: ['work'], k: 'sand' },
  { id: 'dammam', t: 'على طريق الدمام الرياض', kind: 'R', g: '!lo' },
  { id: 'malls', t: 'بين المولات والمطاعم', kind: 'B', who: ['young', 'fam', 'rich'] },
  { id: 'shortruns', t: 'حول البيت', kind: 'I', g: '!hi' },
  { id: 'citytofarm', t: 'بين المدينة والمزرعة', kind: 'B', like: ['palms', 'horses', 'camels', 'shayeb'] },
  { id: 'newdistricts', t: 'في الأحياء الجديدة', kind: 'I' },
  { id: 'gym', t: 'بين البيت والنادي', kind: 'B', who: ['young', 'pro'] },
  { id: 'suppliers', t: 'بين المحل والموردين', kind: 'B', g: 'eco', who: ['trade'], like: ['parts', 'restaurant', 'plumber'] },
  { id: 'veg', t: 'بين البيت وسوق الخضار', kind: 'B', g: 'eco', who: ['old', 'trade', 'fam', 'group'] },
  { id: 'spring', t: 'في مخيمات الربيع', kind: 'O', g: 'x4 tall', k: 'sand' },
  { id: 'warehouse', t: 'بين المستودع والسوق', kind: 'B', g: 'eco', who: ['trade', 'fleet'] },
  { id: 'camps', t: 'في الاستراحات والمخيمات', kind: 'O' },
  { id: 'ring2', t: 'على الدائري الثاني', kind: 'R' },
  { id: 'citytown', t: 'بين المدينة والقرية', kind: 'B' },
  { id: 'narrowfarm', t: 'في طرق المزارع الضيقة', kind: 'O', g: 'eco' },
  { id: 'mosque', t: 'بين البيت والمسجد', kind: 'B', who: ['old'], g: '!hi' },
  { id: 'offices', t: 'بين الدوائر الحكومية', kind: 'B', who: ['pro', 'fleet'], like: ['mouaqqib', 'gov_custody', 'gov_branches'] },
  { id: 'mountains', t: 'في الطلعات والنزلات حول أبها', kind: 'I' },
  { id: 'villa', t: 'بين الفلة والمكتب', kind: 'B', who: ['rich'] },
  { id: 'villafarm', t: 'بين الفلة والمزرعة', kind: 'B', who: ['rich', 'old'] },
  { id: 'airporthome', t: 'بين المطار والبيت', kind: 'B', who: ['rich', 'pro'], like: ['investor', 'captain', 'travel'] },
  { id: 'evenings', t: 'بين المقاهي والسهرات', kind: 'B', who: ['young', 'rich'] },
  { id: 'chalet', t: 'بين البيت والشاليه', kind: 'B', who: ['rich', 'fam', 'young'] },
  { id: 'latenight', t: 'في طلعات آخر الليل', kind: 'I', cls: ['sport', 'top', 'daily'], who: ['young', 'rich'] },
  { id: 'thumama', t: 'على طريق الثمامة', kind: 'R' },
  { id: 'clubs', t: 'بين المكتب والنادي الرياضي', kind: 'B', who: ['rich', 'pro'] },
  { id: 'family_visits', t: 'بين البيت وبيوت الأهل', kind: 'B', who: ['rich', 'fam', 'old', 'pro'] },
  { id: 'feasts', t: 'بين العزايم والمناسبات', kind: 'B', who: ['rich', 'old', 'fam'] },
  { id: 'port', t: 'بين الميناء والمستودعات', kind: 'B', g: 'eco', cls: ['work'], who: ['fleet', 'trade'] },
];

export const FRAMES: Frame[] = [
  { id: 'daily', t: 'تروح وتجي {w} كل يوم', kinds: ['B', 'R'], q: 'D', g: '!lo' },
  { id: 'mostly', t: 'أغلب ممشاها {w}', kinds: ['B', 'R', 'I', 'O'] },
  { id: 'onoff', t: 'ممشاها {w}، يوم إيه ويوم لا', kinds: ['B', 'R', 'I'] },
  { id: 'weekend', t: 'تطلع {w} آخر الأسبوع بس', kinds: ['O', 'R'], q: 'R' },
  { id: 'dawn', t: 'تمشي {w} من الفجر لين المغرب', kinds: ['B', 'R', 'I'], q: 'D', g: '!lo' , roles: ['trade', 'fleet', 'pro', 'young'] },
  { id: 'short', t: 'مشاويرها {w}، وأغلبها قصيرة', kinds: ['I', 'B'], g: '!hi' },
  { id: 'acfull', t: 'عاشت {w} والمكيف شغال على الآخر', kinds: ['B', 'R', 'I'] },
  { id: 'loading', t: 'شغلها {w}، تحميل وتنزيل', kinds: ['B', 'I'], g: 'work', k: 'boot' },
  { id: 'slow', t: 'تمشي {w} على مهلها', kinds: ['B', 'R', 'I', 'O'], k: 'speed' },
  { id: 'twiceweek', t: 'ممشاها {w} مرتين في الأسبوع', kinds: ['B', 'R', 'O'], q: 'R' },
  { id: 'mostlife', t: 'قضت أغلب عمرها {w}', kinds: ['B', 'R', 'I', 'O'] },
  { id: 'slowodo', t: 'ممشاها {w}، والعداد يمشي ببطء', kinds: ['I', 'B'], g: 'lo', q: 'R' },
  { id: 'allyear', t: 'كل يوم {w}، شتا وصيف', kinds: ['B', 'R', 'I'], q: 'D', g: '!lo' },
  { id: 'shadenap', t: 'تمشي {w}، وتنام في مظلة', kinds: ['B', 'I'], k: 'sun' },
  { id: 'needonly', t: 'ما تتحرك إلا للحاجة، وأغلبها {w}', kinds: ['I', 'B'], q: 'R', g: '!hi' },
  { id: 'weekly', t: 'تقطع {w} أكثر من مرة في الأسبوع', kinds: ['R'], g: '!lo' },
  { id: 'calmkm', t: 'مشت {w} كثير بس بهدوء', kinds: ['R', 'B'], g: 'hi', k: 'speed' },
  { id: 'acon', t: 'تمشي {w} والمكيف ما يطفي', kinds: ['B', 'R', 'I'] },
  { id: 'allyearround', t: 'طول السنة {w}', kinds: ['B', 'R', 'I', 'O'] },
  { id: 'kms', t: 'أغلب كيلواتها {w}', kinds: ['B', 'R', 'I', 'O'] },
  { id: 'shifts', t: 'تشتغل {w} في كل ساعة من اليوم', kinds: ['B', 'I', 'R'], q: 'D', g: 'hi' , roles: ['trade', 'fleet', 'pro', 'young'] },
  { id: 'early', t: 'تطلع {w} الصبح بدري قبل الحر', kinds: ['O', 'R'] },
  { id: 'seasons', t: 'ممشاها {w} في المواسم، والباقي واقفة', kinds: ['O', 'R', 'B'], q: 'R' },
  { id: 'wholelife', t: 'عمرها كله {w}', kinds: ['B', 'R', 'I', 'O'] },
  { id: 'nospeed', t: 'تمشي {w}، وصاحبها ما يحب السرعة', kinds: ['B', 'R', 'I'], person: true, k: 'speed' },
  { id: 'norest', t: 'كانت تشتغل {w} بدون راحة', kinds: ['B', 'I', 'R'], q: 'D', g: '!lo' , roles: ['trade', 'fleet', 'pro', 'young'] },
  { id: 'weekafter', t: 'تتنقل {w} أسبوع ورا أسبوع', kinds: ['B'] },
  { id: 'turns', t: 'ساقوها {w} بالدور', kinds: ['B', 'I'], group: true, k: 'driver' },
  { id: 'friwash', t: 'تمشي {w}، وتنغسل كل جمعة', kinds: ['B', 'I'], k: 'wash' },
  { id: 'thursday', t: 'تطلع {w} ليلة الخميس والجمعة', kinds: ['O', 'R'], q: 'R' },
  { id: 'half', t: 'نص عمرها {w}', kinds: ['B', 'R', 'I', 'O'] },
  { id: 'fixed', t: 'تمشي {w} على مواعيد ثابتة', kinds: ['B', 'R'] },
  { id: 'became', t: 'بدت حياتها {w}، وبعدين صارت سيارة البيت', kinds: ['B', 'R', 'I'], g: 'old' },
  { id: 'night', t: 'أغلب مشاويرها {w} بالليل', kinds: ['B', 'R', 'I', 'O'] },
  { id: 'sameday', t: 'تروح {w} وترجع نفس اليوم', kinds: ['R'] },
  { id: 'mostplace', t: 'مشت {w} أكثر من أي مكان ثاني', kinds: ['B', 'R', 'I', 'O'] },
  { id: 'wholeweek', t: 'الأسبوع كله {w}', kinds: ['B', 'I', 'R'], q: 'D' , roles: ['trade', 'fleet', 'pro', 'young'] },
  { id: 'shiftstart', t: 'تشتغل {w} أول الدوام وتطفي آخره', kinds: ['B', 'I'], q: 'D', g: 'eco' , roles: ['trade', 'fleet', 'pro', 'young'] },
  { id: 'summertrip', t: 'ممشاها {w}، وفي الصيف تسافر', kinds: ['B', 'I'] },
  { id: 'overhalf', t: 'أكثر من نص ممشاها {w}', kinds: ['B', 'R', 'I', 'O'] },
  { id: 'sunpark', t: 'تمشي {w} وتوقف في الشمس', kinds: ['B', 'I'], g: 'eco', k: 'sun' },
  { id: 'gentle', t: 'ممشاها {w}، ونادر تشوف دعسة قوية', kinds: ['B', 'I', 'R'], k: 'speed' },
];

/** frames for a car that has barely been driven (under 15,000 km): the only ones it gets */
export const FRESH_FRAMES: Frame[] = [
  { id: 'onlyyet', t: 'ما مشت للحين إلا {w}', kinds: ['B', 'I', 'R', 'O'] },
  { id: 'littlekm', t: 'كل ممشاها القليل {w}', kinds: ['B', 'I', 'R', 'O'] },
  { id: 'fewtimes', t: 'طلعت كم مرة بس، أغلبها {w}', kinds: ['B', 'I', 'R', 'O'] },
  { id: 'sincebought', t: 'من يوم استلمها ما مشى فيها إلا {w}', kinds: ['B', 'I', 'R', 'O'], person: true },
  { id: 'smallodo', t: 'عدادها صغير، وأغلبه {w}', kinds: ['B', 'I', 'R', 'O'] },
  { id: 'firstweeks', t: 'أول أسابيعها كانت {w}', kinds: ['B', 'I', 'R', 'O'] },
];

export const USE_WHOLE: Whole[] = [
  { t: 'أغلب ممشاها طرق سريعة، وهذا يبان في نعومة القير', g: 'hi' },
  { t: 'تنام في مظلة، والطبلون ما شاف شمس الظهر كثير', k: 'sun' },
  { t: 'وقفت في الشمس سنين، والطبلون يشهد', g: 'old', k: 'sun' },
  { t: 'طلعت البر كثير، والرمل للحين في زوايا الشنطة', g: 'x4', k: 'sand' },
  { t: 'تسافر كل عيد بين مدينتين، والباقي واقفة', q: 'R' },
  { t: 'ساقها أكثر من واحد، كل واحد بطريقته', g: 'o2', k: 'driver' },
  { t: 'مخدومة على الموعد حتى لو ما مشت المسافة', g: 'lo', k: 'service' },
  { t: 'تعرف محطات طريق الشمال بالاسم', g: 'hi' },
  { t: 'تعيش في مواقف تحت الأرض', cls: ['lux', 'top', 'sport'], k: 'sun' },
  { t: 'ساحلية، رطوبة البحر حولها طول السنة' },
  { t: 'وقفت أشهر وصاحبها مسافر، وبعدين رجعت للشغل' },
  { t: 'مشاوير مدارس الصبح والظهر، تشغيل وطفي كثير', g: 'fam', k: 'kids' },
  { t: 'نص ممشاها سفر ونصه مدينة' },
  { t: 'ما تطلع من الحي إلا نادر', g: 'lo', q: 'R' },
  { t: 'شافت سيول مرة أو مرتين في الشارع وطلعت منها' },
  { t: 'ممشاها كله توصيل، وقوف وطلوع كل خمس دقايق', g: 'hi', q: 'D' },
  { t: 'تعيش في كراج مسكّر وتطلع للتجمعات', cls: ['lux', 'top', 'sport', 'classic'], q: 'R', k: 'sun' },
  { t: 'ركبها الضيوف أكثر من أهلها', cls: ['lux', 'top'] },
  { t: 'أغلبها مشاوير قصيرة، والمكينة ما تلحق تسخن', g: 'lo' },
  { t: 'السنين عليها أكثر من الكيلوات', g: 'old lo' },
  { t: 'استعمال ثقيل في الصيف وخفيف بقية السنة' },
  { t: 'ممشى مستأجرين ورا بعض، كل واحد أسبوع', g: 'rent', k: 'driver' },
  { t: 'كانت سيارة كشتات، تطلع البر كل شتا', g: 'x4', k: 'sand' },
  { t: 'تقطع خط الجنوب الجبلي كل صيف' },
];

// ---------------------------------------------------------------- why it is out: a cause and what follows

export const CAUSES: Cause[] = [
  // moving away
  { id: 'transfer', t: 'نقل شغله لمدينة ثانية', cat: 'move' },
  { id: 'east', t: 'انتقل للشرقية', cat: 'move' },
  { id: 'north', t: 'جاه نقل للشمال', cat: 'move' },
  { id: 'scholar', t: 'بيسافر بعثة سنتين', cat: 'move' },
  { id: 'abroad', t: 'جاه عرض شغل برا البلد', cat: 'move' },
  // the family grew
  { id: 'third', t: 'جاه الولد الثالث', cat: 'grow', g: 'small' },
  { id: 'married', t: 'تزوج وجاه ولد', cat: 'grow', g: 'small' },
  { id: 'mumhome', t: 'الوالدة صارت ساكنة معهم', cat: 'grow', g: 'small' },
  { id: 'grown', t: 'العيال كبروا', cat: 'grow', g: 'small' },
  // needs the money
  { id: 'land', t: 'اشترى أرض', cat: 'cash' },
  { id: 'project', t: 'دخل في مشروع مع ربعه', cat: 'cash' },
  { id: 'wedding', t: 'عرسه قريب', cat: 'cash' },
  { id: 'house', t: 'باقي عليه أقساط البيت', cat: 'cash' },
  { id: 'shop', t: 'بيفتح محل', cat: 'cash' },
  { id: 'deposit', t: 'يجمع الدفعة الأولى للبيت', cat: 'cash' },
  { id: 'stocks', t: 'عينه على فرصة في السوق', cat: 'cash' },
  // something newer
  { id: 'newmodel', t: 'شرى الموديل الجديد', cat: 'new' },
  { id: 'booked', t: 'حجز سيارة جديدة من الوكالة', cat: 'new' },
  { id: 'bored', t: 'ملّ منها', cat: 'new' },
  { id: 'tryelse', t: 'يبي يجرب شي ثاني', cat: 'new' },
  { id: 'companycar', t: 'استلم سيارة من الشركة', cat: 'new' },
  // less driving
  { id: 'retired', t: 'تقاعد', cat: 'less' },
  { id: 'remote', t: 'صار يشتغل من البيت', cat: 'less' },
  { id: 'son', t: 'ولده صار يوديه ويجيبه', cat: 'less' },
  { id: 'apps', t: 'صار يعتمد على التطبيقات', cat: 'less' },
  { id: 'nearjob', t: 'شغله صار جنب البيت', cat: 'less' },
  { id: 'walks', t: 'صار يمشي على رجوله أكثر', cat: 'less', g: 'lo' },
  // worry and costs
  { id: 'bigservice', t: 'قرب موعد صيانتها الكبيرة', cat: 'cost', g: 'hi' },
  { id: 'warranty', t: 'ضمانها خلص', cat: 'cost', g: 'new' },
  { id: 'workshops', t: 'ملّ من الورش', cat: 'cost', g: '!new' },
  { id: 'costs', t: 'كثرت مصاريفها عليه', cat: 'cost', g: '!new' },
  { id: 'insurance', t: 'التأمين زاد عليه بعد حادث بسيط', cat: 'cost' },
  { id: 'euro', t: 'تعب من صيانة الأوروبي', cat: 'cost', cls: ['lux', 'top', 'sport'] },
  // the work it did is over
  { id: 'closed', t: 'سكّر المحل', cat: 'job', g: 'work' },
  { id: 'projectdone', t: 'خلص المشروع اللي كانت له', cat: 'job', g: 'work' },
  { id: 'soldfarm', t: 'باع المزرعة', cat: 'job', g: 'work' },
  { id: 'newjob', t: 'غيّر شغله', cat: 'job', g: 'work' },
  // an estate
  { id: 'heirs', t: 'الورثة يبون يقسمون', cat: 'estate', g: 'old' },
  { id: 'split', t: 'انقسم الورث', cat: 'estate', g: 'old' },
  // a fleet
  { id: 'renew', t: 'الشركة تجدد أسطولها', cat: 'fleet', g: 'cmp' },
  { id: 'contract', t: 'انتهى عقد التأجير', cat: 'fleet', g: 'rent' },
  { id: 'clearout', t: 'مكتب التأجير يصفّي القديم', cat: 'fleet', g: 'rent' },
  { id: 'surplus', t: 'الجهة تبيع الفائض', cat: 'fleet', g: 'gov' },
  { id: 'leasing', t: 'الشركة صارت تستأجر بدال ما تملك', cat: 'fleet', g: 'cmp' },
  // a rich man's reasons
  { id: 'classic2', t: 'عنده كلاسيك ثانية تاخذ وقته كله', cat: 'rich', cls: ['lux', 'top', 'sport', 'classic'] },
  { id: 'driver', t: 'صار عنده سواق', cat: 'rich', cls: ['lux', 'top', 'sport'] },
  { id: 'ev', t: 'يبي يجرب الكهربا', cat: 'rich', cls: ['lux', 'top', 'sport'] },
  { id: 'yearmodel', t: 'حجز موديل السنة', cat: 'rich', cls: ['lux', 'top', 'sport'] },
  { id: 'rareoffer', t: 'جاه عرض على سيارة نادرة', cat: 'rich', cls: ['lux', 'top', 'sport', 'classic'] },
  { id: 'makeroom', t: 'يفضّي مكان لسيارة جاية', cat: 'rich', cls: ['lux', 'top', 'sport', 'classic'] },
  { id: 'attention', t: 'ملّ من لفت النظر', cat: 'rich', cls: ['top', 'sport'] },
  { id: 'kidsgrown', t: 'عياله كبروا وصار يبي شي عائلي', cat: 'rich', cls: ['sport', 'top'] },
  { id: 'twoofsame', t: 'صار عنده ثنتين من نفس الشركة', cat: 'rich', cls: ['lux', 'top', 'sport'] },
];

export const NEEDS: Need[] = [
  { id: 'noship', t: 'وما يبي يشحنها', cat: 'move' },
  { id: 'noplace', t: 'وما له خلق يدبّر لها مكان', cat: 'move' },
  { id: 'freshstart', t: 'ويبي يبدأ هناك من جديد', cat: 'move' },
  { id: 'idle', t: 'والسيارة بتوقف بلا فايدة', cat: 'move' },
  { id: 'twoyears', t: 'وما يبيها تنام في الشمس سنتين', cat: 'move' },
  { id: 'bigger', t: 'ويبي شي أكبر', cat: 'grow' },
  { id: 'nofit', t: 'والسيارة ما عادت تشيلهم', cat: 'grow' },
  { id: 'familysuv', t: 'ويبي جيب عائلي', cat: 'grow' },
  { id: 'thirdrow', t: 'وصار يحتاج صف ثالث', cat: 'grow' },
  { id: 'cash', t: 'ويحتاج السيولة', cat: 'cash' },
  { id: 'cashnow', t: 'والكاش أهم من السيارة الحين', cat: 'cash' },
  { id: 'lighter', t: 'ويبي يخفف التزاماته', cat: 'cash' },
  { id: 'quicker', t: 'وقال المزاد أسرع من الحراج', cat: 'cash' },
  { id: 'noloan', t: 'وما يبي يدخل في قرض', cat: 'cash' },
  { id: 'nospace', t: 'وما لها مكان في الحوش', cat: 'new' },
  { id: 'notwo', t: 'وما يبي سيارتين', cat: 'new' },
  { id: 'beforedrop', t: 'ويبي يبيع قبل لا ينزل سعرها', cat: 'new' },
  { id: 'noneed', t: 'وما عاد يحتاجها', cat: 'new' },
  { id: 'notwoless', t: 'وما عاد يحتاج سيارتين', cat: 'less' },
  { id: 'standing', t: 'والسيارة واقفة أغلب الوقت', cat: 'less' },
  { id: 'noinsure', t: 'وما يبي يدفع تأمين على سيارة واقفة', cat: 'less' },
  { id: 'pity', t: 'ويقول خسارة توقف في الشمس', cat: 'less' },
  { id: 'beforecost', t: 'ويبي يبيع قبل لا تكلفه أكثر', cat: 'cost' },
  { id: 'norisk', t: 'وما يبي يغامر', cat: 'cost' },
  { id: 'easy', t: 'ويبي شي يرتاح معه', cat: 'cost' },
  { id: 'enough', t: 'ويقول عطته اللي عندها', cat: 'cost', g: 'hi' },
  { id: 'nowork', t: 'وما عاد لها شغل', cat: 'job' },
  { id: 'emptybed', t: 'والحوض صار فاضي', cat: 'job', g: 'work' },
  { id: 'allgear', t: 'ويبي يصفّي العدة كلها', cat: 'job' },
  { id: 'everyone', t: 'وكل واحد يبي نصيبه', cat: 'estate' },
  { id: 'nobodywants', t: 'ومحد منهم يبيها', cat: 'estate' },
  { id: 'batch', t: 'وهذي من الدفعة الأولى', cat: 'fleet' },
  { id: 'agelimit', t: 'وكل سيارة تعدّت عمر معيّن تنباع', cat: 'fleet' },
  { id: 'fastest', t: 'والمزاد أسرع لهم', cat: 'fleet' },
  { id: 'nowait', t: 'وما تنتظر عندهم', cat: 'fleet' },
  { id: 'quieter', t: 'ويبي شي أهدأ', cat: 'rich' },
  { id: 'otherone', t: 'والثانية تكفيه', cat: 'rich' },
  { id: 'nogarage', t: 'وما يبيها توقف في الكراج', cat: 'rich' },
  { id: 'onegarage', t: 'والكراج ما يشيل الكل', cat: 'rich' },
  { id: 'appreciate', t: 'ويبيها تروح لواحد يقدّرها', cat: 'rich' },
  { id: 'notstanding', t: 'وما يبيها تقعد واقفة', cat: 'rich' },
  { id: 'onesells', t: 'وقال وحدة لازم تطلع', cat: 'rich' },
  { id: 'cashforother', t: 'ويبي قيمتها للثانية', cat: 'rich' },
  { id: 'samehouse', t: 'وما يبي يبدّل سيارة بسيارة في نفس البيت', cat: 'new' },
  { id: 'sellnow', t: 'ويقول البيع الحين أحسن', cat: 'new' },
  { id: 'cashother', t: 'ويبي يدفع قيمتها في الجديدة', cat: 'new' },
  { id: 'faraway', t: 'والسيارة ما تسوى تكلفة الشحن', cat: 'move' },
  { id: 'savings', t: 'ويبي يقلل مصاريف الشهر', cat: 'cash' },
  { id: 'whatsleft', t: 'ويكمّل الناقص من قيمتها', cat: 'cash' },
  { id: 'oneenough', t: 'وسيارة وحدة تكفيه', cat: 'less' },
  { id: 'battery', t: 'وكل ما جا يشغّلها لقى البطارية نايمة', cat: 'less' },
  { id: 'nextbill', t: 'وما يبي ينتظر الفاتورة الجاية', cat: 'cost' },
  { id: 'simpler', t: 'ويبي شي أبسط', cat: 'cost' },
];

export const WHY_WHOLE: Whole[] = [
  { t: 'صاحبها شرى عائلية بعد ما زادوا العيال', g: 'small' },
  { t: 'نقل وظيفته برا المدينة وما يبي يشحنها' },
  { t: 'يبي يسدد قسط الأرض' },
  { t: 'صاحبها مسافر دراسة سنتين' },
  { t: 'عنده سيارتين والتأمين على الثنتين يوجع' },
  { t: 'يبي يغير لهايبرد، البنزين صار سالفة المجلس' },
  { t: 'الزوجة تبي شي أعلى من الأرض', g: 'eco small' },
  { t: 'ما عاد يطلع البر مثل أول', g: 'x4' },
  { t: 'الولد كبر وأخذ سيارة، والبيت فيه سيارة زيادة' },
  { t: 'المواقف في العمارة الجديدة ما تكفي' },
  { t: 'يبيعها قبل لا يجي موعد الصيانة الكبيرة', g: 'hi' },
  { t: 'يبي شي أصغر للمدينة', g: 'fam' },
  { t: 'يبي شي أكبر للسفر', g: 'small' },
  { t: 'صاحبها يقول خلاص عطتني اللي عندها', g: 'hi' },
  { t: 'المعرض يدوّر البضاعة قبل آخر السنة' },
  { t: 'جته من دين، وهو أصلاً ما يحبها' },
  { t: 'يجمع للمهر', g: 'eco' },
  { t: 'زوجته ما ترتاح في كراسيها' },
  { t: 'اشترى بيت والميزانية تبي ترتيب' },
  { t: 'قالوا له المزاد يجيب سعر أحسن من الحراج' },
  { t: 'جاه نقل لدولة ثانية' },
  { t: 'كبرت عليه، يقول ما يبي يدوّر موقف كل مرة', g: 'fam' },
  { t: 'رجع لسيارة الشركة وهذي زادت' },
  { t: 'التأمين زاد عليه بعد حادث بسيط' },
  { t: 'يبي يبيع قبل لا ينزل سعرها أكثر', g: 'new' },
  { t: 'ما يبي يجدد الفحص ويتعب في المواعيد', g: 'old' },
  { t: 'اكتشف إنه يمشي على رجوله أكثر', g: 'lo' },
  { t: 'ملّ من صيانة الأوروبي، يقول يبي ياباني ويرتاح', cls: ['lux', 'top', 'sport'] },
];

// ---------------------------------------------------------------- what you notice at the viewing

/** plain quirks: a thing and its state; the thing never comes back the next night with another state */
export const THINGS: Thing[] = [
  { id: 'armrest', s: ['مسند اليد في النص قفله مكسور ويفتح لحاله', 'جلد مسند اليد في النص مقشّر من كثر الاتكاء', 'مسند اليد في النص مليان أوراق ومفاتيح قديمة'] },
  { id: 'seats', s: ['جلد كرسي السواق متشقق عند الطرف', 'كرسي الراكب أنعم من كرسي السواق، الراكب قليل', 'كرسي السواق نازل شوي من جهة الباب'], k: 'seat' },
  { id: 'pedals', s: [['دواسة البنزين ماسحة من كثر الدعس', 'hi'], 'على دواسة الفرامل غطا ألمنيوم مركّب برا', 'مطاط دواسة الفرامل جديد وباقي الدواسات قديمة'], g: '!lo' },
  { id: 'wheel', s: ['الدركسون عليه غطا جلد مخيوط باليد', ['جلد الدركسون ماسح عند مكان الإبهام', 'hi'], ['الدركسون عليه غطا مطاط من محطة بنزين', 'eco']] },
  { id: 'mats', s: ['السجاد الأصلي وفوقه سجاد ثاني', 'دعاسات مطاط مفصلة ونظيفة', ['سجادة السواق مثقوبة تحت الكعب', 'hi']] },
  { id: 'cups', s: ['مكان الكاسات فيه أثر حلقات قهوة قديمة', 'في مكان الكاسات علبة مناديل مثبتة بلاصق', 'مكان الكاسات طرفه مكسور'] },
  { id: 'visor', s: [['غطاء الشمس {side} يطيح لحاله', 'old'], 'مراية غطاء الشمس {side} مكسورة', 'في غطاء الشمس كرت ورشة قديم مدسوس'] },
  { id: 'pocket', s: ['جيب باب السواق فيه أقلام ومناديل من سنين', 'في جيب الباب {door} مظلة صغيرة', ['في جيب الباب {door} أشرطة كاسيت قديمة', 'old']], k: 'mess' },
  { id: 'winbtn', s: ['زر النافذة {win} يبي ضغطتين', 'النافذة {win} تنزل وتوقف في النص', 'النافذة {win} تطلع ببطء'] },
  { id: 'headliner', s: [['السقف الداخلي نازل شوي عند الزجاج الخلفي', 'old'], 'في السقف الداخلي بقعة صغيرة فوق الراكب', 'لمبة السقف الداخلية ما تولع'] },
  { id: 'belts', s: ['حزام الأمان الخلفي ما ينسحب إلا بهدوء', 'حزام السواق يرجع ببطء', 'حزام الراكب عليه غطا قطن'] },
  { id: 'charger', s: ['فيها شاحن لاسلكي مركّب برا', ['شاحن الولاعة فيه جهاز بلوتوث قديم', 'old'], 'شاحن جوال مربوط بسلك تحت الطبلون'] },
  { id: 'scent', s: ['ريحة عود خفيفة باقية في الفرش', 'ريحة قهوة عربية في الكابينة', 'ريحة معطر فانيلا قوية', 'ريحة جلد نظيفة في الكابينة'], k: 'smell' },
  { id: 'freshener', s: ['معطر شجرة معلق في المراية وريحته راحت من زمان', 'علبة معطر فاضية على فتحة المكيف', 'كيس فحم ماص للريحة تحت الكرسي'], k: 'smell' },
  { id: 'rattle', s: ['رنة خفيفة من الدرج على المطبات', 'طقطقة خفيفة من الطبلون مع الحر', 'خشخشة من الباب {door} على المطبات'] },
  { id: 'horn', s: ['الهرن صوته أعلى من الأصلي، مغيّر', 'الهرن ضعيف شوي', 'فيها هرن ثاني مركّب برا'] },
  { id: 'tyrenoise', s: ['هدير خفيف من الكفرات فوق 100', 'الكفرات صوتها عالي على الأسفلت الخشن', 'الكفرات هادية حتى على السرعة'], k: 'tyre' },
  { id: 'doors', s: [['صرير من الباب {door} مع الفتح', 'old'], 'الباب {door} يبي دفة قوية عشان يتسكّر', 'مفصلة الباب {door} تبي شحم'] },
  { id: 'parking', s: ['ملصق موقف جامعة قديم على الزجاج الأمامي', 'ملصق دخول مجمّع سكني على الزجاج', 'ملصق موقف مستشفى على الزجاج'], k: 'sticker' },
  { id: 'windscreen', s: ['شرخ صغير في زاوية الزجاج الأمامي', 'نقش حصى صغير على الزجاج الأمامي', 'الزجاج الأمامي سليم ولا عليه خدش'] },
  { id: 'tint', s: [['تظليل الزجاج الخلفي فيه فقاعات صغيرة', 'old'], 'تظليل أمامي خفيف ما يبان إلا من قريب', 'التظليل غامق أكثر من المسموح'] },
  { id: 'servicetag', s: ['ملصق وكالة بأول صيانة في زاوية الزجاج', 'ملصق غيار زيت على الزجاج وآخر موعد فيه قريب'], k: 'service' },
  { id: 'keys2', s: ['المفتاح الاحتياطي في علبته مع الكتيب', 'معها مفتاحين وواحد منهم بطاريته ضعيفة'], g: 'k2', k: 'key' },
  { id: 'keys1', s: ['المفتاح منسوخ عند خرّاط مو من الوكالة', 'مفتاح واحد بس، والاحتياطي ضايع'], g: 'k1', k: 'key' },
  { id: 'keyfob', s: ['المفتاح في جراب جلد قديم', ['زر الريموت ممسوح من كثر الضغط', 'hi'], 'ميدالية المفتاح من معرض في مدينة ثانية', 'بطارية الريموت ضعيفة، يفتح من قريب بس'], k: 'key' },
  { id: 'spare', s: ['الإطار الاحتياطي ما استخدم، للحين عليه الشعيرات', 'الإطار الاحتياطي مو مقاسها، من سيارة ثانية', 'الإطار الاحتياطي هواه ناقص'], k: 'tyre' },
  { id: 'rims', s: ['الجنوط مقاس أكبر من الأصلي بإنش', 'الجنوط عليها خدوش رصيف', ['الجنوط مصبوغة أسود', '!old']] },
  { id: 'valves', s: ['غطيان البلوف في الكفرات ناقصة اثنين', 'غطيان البلوف كروم مركّبة برا'] },
  { id: 'bootkit', s: ['في الشنطة طفاية ومثلث وشنطة إسعاف', 'الشنطة فيها عدة كاملة مرتبة في كيسها', 'في الشنطة {boot}'], k: 'boot' },
  { id: 'bootlid', s: [['قفل الشنطة يبي ضغطة قوية', 'old'], 'باب الشنطة ما يثبت فوق لحاله', 'زر فتح الشنطة يتأخر'] },
  { id: 'scratch', s: ['خدش طويل خفيف على الباب {door}', ['نقش حصى كثير على الصدام الأمامي', 'hi'], 'خدوش خفيفة حول مقبض الباب {door}'], k: 'paint' },
  { id: 'shine', s: ['تلميع جديد يلمع أكثر من اللازم', 'اللون صاحي، شكلها عاشت في مظلة', ['السقف فيه بهتان من الشمس', 'old'], 'حماية شفافة على الكبوت والمرايات'], k: 'sun' },
  { id: 'screen', s: ['شاشة الوسط فيها خط ميت صغير', 'شاشة الوسط تتأخر شوي أول التشغيل', ['شاشة الوسط مغيّرة بشاشة أكبر', 'eco']], g: 'n15' },
  { id: 'camera', s: ['الكاميرا الخلفية ضبابية شوي', 'خطوط الكاميرا الخلفية ما تلف مع الدركسون', 'الكاميرا الخلفية فيها نقطة ماي ناشفة'], g: 'n15' },
  { id: 'clock', s: ['ساعة الطبلون متأخرة ساعة، محد ضبطها', 'ساعة الطبلون على توقيت بلد ثاني', 'منبه حزام الأمان مطفي من الإعدادات'] },
  { id: 'tpms', s: ['حساس ضغط الكفرات ينور ويطفي', 'حساس ضغط كفر واحد يقرا غلط'], g: 'n15', k: 'tyre' },
  { id: 'lights', s: ['الإضاءة الداخلية مغيّرة لِد أبيض', 'لمبة الشنطة محروقة', 'لمبة اللوحة الخلفية وحدة شغالة ووحدة لا'] },
  { id: 'wipers', s: [['المساحات تشتغل على سرعة وحدة بس', 'old'], 'المساحات جديدة توها مركّبة', 'رشاش الماي الأمامي ضعيف'] },
  { id: 'phone', s: ['كاميرا قدام مثبتة بالشفاط ومعها شريحة', 'قاعدة جوال مثبتة بالبراغي في الطبلون', 'حامل جوال مغناطيس على فتحة المكيف'] },
  { id: 'bay', s: ['تحت الكبوت نظيف ومرشوش ملمّع', 'تحت الكبوت تراب أكثر من برا، مغسولة من برا بس', 'البطارية جديدة وتاريخها هالسنة', 'أسلاك زايدة تحت الكبوت مربوطة بشريط'] },
  { id: 'sensors', s: ['حساسات ركن مركّبة برا ولونها مو مطابق', 'حساس ركن قدام ما يصفّر'] },
  { id: 'papers', s: ['الاستمارة في غلاف بلاستيك قديم', 'دفتر صغير في الدرج فيه مواعيد غيار الزيت بخط اليد', 'كتيب السيارة في الدرج في كيسه'], k: 'book' },
  { id: 'seatcover', s: ['الكراسي مكسوة جلد مفصّل', 'على الكراسي كسوة قماش مطبوعة', 'على الكرسي الخلفي أثر كرسي أطفال'], k: 'seat' },
  { id: 'vents', s: ['ريشة وحدة من فتحات المكيف مكسورة', 'فتحات المكيف الخلفية عليها غبار'] },
  { id: 'mirrors', s: ['زجاج المراية {side} مغيّر', 'المراية {side} ما تنطوي بالكهربا', 'المرايات تنطوي لحالها مع القفل'] },
  { id: 'plateframe', s: ['إطار اللوحة من معرض في مدينة ثانية', 'إطار اللوحة كروم ومشدود ببراغي جديدة'] },
  { id: 'guard', s: ['رفارف طين مركّبة ورا', 'شبك حماية قدام الرديتر من الحصى'], g: 'eco' },
  { id: 'x4kit', s: ['ونش أمامي مركّب على الصدام', 'حماية أسفل المكينة معدن مركّبة برا', 'عتبات جانبية وفيها حكة رمل', 'حبل سحب وكابل اشتراك ما فارقوها', 'تحت أرضية الشنطة رمل ناعم في الزوايا', 'كمبروسر هوا صغير مثبت في الشنطة'], g: 'x4 tall', k: 'sand' },
  { id: 'roof', s: ['فوقها شبك سقف للأغراض', 'أثر شبك سقف مفكوك'], g: 'fam eco' },
  { id: 'hitch', s: ['فيها شنكل سحب ورا', 'أثر شنكل سحب مفكوك ورا'], g: 'eco x4' },
  { id: 'luxcabin', s: ['ستارة الزجاج الخلفي الكهربا تعلق في النص', 'ثلاجة الكونسول تبرد زيادة', 'كرسي المساج اليسار أضعف من اليمين', 'الساعة اللي في الطبلون متأخرة دقيقتين'], cls: ['lux', 'top'] },
  { id: 'sportbits', s: ['خدش تحت الصدام الأمامي من المطبات', 'الكفرات الخلفية أمسح من الأمامية بكثير', 'وضع الحلبة مختار في الشاشة من آخر مرة'], cls: ['sport', 'top'] },
  { id: 'classicbits', s: ['الراديو الأصلي للحين يشتغل', 'الطبلون عليه غطا سجاد من زمان', ['أرقام العداد صفرت من الشمس', 'old']], cls: ['classic'] },
  { id: 'workbits', s: ['صندوق عدة مثبت في الحوض', 'سقف الحوض ألمنيوم مركّب برا', 'أرضية الحوض عليها أثر أسمنت', 'حماية الحوض بلاستيك وعليها خدوش شغل'], g: 'work', cls: ['work', 'lux', 'classic', 'junk'], k: 'boot' },
];

export const MORE_THINGS: Thing[] = [
  { id: 'stains', s: ['بقعة قهوة على كرسي الراكب', 'بقعة حبر صغيرة على الكرسي الخلفي', 'أثر عصير ناشف تحت الكرسي {side}'] },
  { id: 'glovebox', s: ['درج الراكب ما يتسكّر إلا بدفة', 'في درج الراكب نظارة شمس قديمة', 'في درج الراكب فواتير بنزين ملفوفة', 'في درج الراكب كيس مناديل وقلم'], k: 'mess' },
  { id: 'console', s: ['في الكونسول ريالات معدن من سنين', 'غطا الكونسول يصرّ مع الفتح', 'في الكونسول شاحن قديم وسماعة'] },
  { id: 'aerial', s: ['الإريل مكسور من فوق', 'الإريل مغيّر بقصير'] },
  { id: 'bumpersticker', s: ['ملصق صغير على الصدام الخلفي باسم معرض', 'ملصق مدينة ثانية على الصدام الخلفي'], k: 'sticker' },
  { id: 'headlamps', s: ['زجاج الشمعة الأمامية {side} مصفّر', 'الشمعة الأمامية {side} مغيّرة وأوضح من الثانية', 'الإشارة الجانبية {side} لونها باهت'] },
  { id: 'taillamps', s: ['في الإسطب الخلفي {side} شرخ صغير عليه لاصق', 'الإسطب الخلفي {side} أجدد من الثاني'] },
  { id: 'handles', s: ['مقبض الباب {door} من داخل مرتخي', 'مقبض الباب {door} من برا لونه باهت'] },
  { id: 'radio', s: ['الراديو على إذاعة رياضية ومحد غيّرها', 'فلاش في منفذ الشاشة مليان شيلات', 'صوت السماعة {side} قدام أضعف من الثانية'] },
  { id: 'seatpos', s: ['كرسي السواق مرجّع لورا على الآخر', 'كرسي السواق مقدّم على الآخر', 'ظهر كرسي السواق مايل أكثر من العادة'], k: 'seat' },
  { id: 'rearview', s: ['المراية الداخلية مرتخية وتنزل مع المطبات', 'المراية الداخلية مغيّرة بعريضة'] },
  { id: 'fuelcap', s: ['غطا البنزين مو أصلي', 'باب البنزين يبي ضغطتين عشان ينفتح', 'باب البنزين ما يتسكّر زين'] },
  { id: 'jack', s: ['الجك والمفتاح مو في مكانهم', 'الجك مو أصلي، من سيارة ثانية', 'الجك والمفتاح جديدة في كيسها'], k: 'tyre' },
  { id: 'sunroof', s: ['فتحة السقف تصفّر فوق 100', 'ستارة فتحة السقف تعلق في النص', 'مطاط فتحة السقف ناشف، ما انفتحت من زمان'], g: 'n15', cls: ['fam', 'lux', 'top', 'sport'] },
  { id: 'seatcool', s: ['تبريد الكرسي {side} أضعف من الثاني', 'تدفئة الكراسي ما استخدمت ولا مرة'], g: 'n15', cls: ['lux', 'top', 'fam'] },
  { id: 'chrome', s: ['كروم الشبك مقشّر شوي', 'كروم مقابض الأبواب باهت'] },
  { id: 'mudflap', s: ['رفرف الطين {side} ورا ناقص', 'رفارف الطين جديدة ومركّبة بلون السيارة'], g: 'eco' },
  { id: 'umbrella', s: ['مظلة الزجاج الأمامي مطوية ورا الكرسي', 'ستارة شمس للزجاج الخلفي مثبتة بالشفاط'], k: 'sun' },
  { id: 'kidsbits', s: ['ألعاب أطفال صغيرة تحت الكرسي الخلفي', 'شاشة أطفال مثبتة ورا كرسي السواق', 'غطا حماية ورا الكراسي من رجول الأطفال'], g: 'fam', cls: ['fam', 'daily'], k: 'kids' },
  { id: 'luxtrim', s: ['خشب الطبلون فيه خدش صغير عند الكونسول', 'إضاءة الأبواب الداخلية وحدة منها مطفية', 'ريحة الجلد الأصلي للحين في الكابينة'], cls: ['lux', 'top'] },
];

export const BOOT_BITS = ['كراسي بر قابلة للطي', 'دلة وترامس', 'شنطة سفر فاضية', 'كورة ومضخة هوا', 'كراتين ماي', 'كيس فحم وشواية', 'مظلة شمس للزجاج', 'سلك اشتراك ومثلث'];

/** tells: whole lines tied to the hidden truth (T:<surprise>, P painted panel, hot engine, ac weak AC, sus suspension) */
export const TELLS: Whole[] = [
  { t: 'ريحة رطوبة خفيفة تحت دواسات الأرض', g: 'T:flood' },
  { t: 'تحت السجاد الخلفي ملمس رطب وطين ناشف في الزوايا', g: 'T:flood' },
  { t: 'أثر صدا وماي ناشف في حوض الإطار الاحتياطي', g: 'T:flood' },
  { t: 'ريحة شي محروق خفيفة بعد المشوار', g: 'hot' },
  { t: 'صفير بسيط من السير أول دقيقة', g: 'hot' },
  { t: 'المروحة تعلى وتوطى بدون سبب واضح', g: 'hot' },
  { t: 'رديتر جديد يلمع وسط مكينة قديمة', g: 'hot old' },
  { t: 'غطاء الرديتر عليه أثر بخار ناشف', g: 'hot' },
  { t: 'خزان الماي لونه بني من داخل', g: 'hot' },
  { t: 'طقطقة من قدام يمين مع اللف الكامل', g: 'sus' },
  { t: 'دق خفيف من ورا على المطبات', g: 'sus' },
  { t: 'الكفرات الأمامية ماكلة من الحافة الداخلية', g: 'sus' },
  { t: 'زيت الدركسون ناقص وأثر تهريب حول الخزان', g: 'sus' },
  { t: 'ونّة من القير مع الدعسة القوية', g: 'T:gearbox' },
  { t: 'القير يتأخر ثانية في التعشيق وهو بارد', g: 'T:gearbox' },
  { t: 'المكينة تقرقع ثانيتين أول التشغيل البارد', g: 'T:oil' },
  { t: 'ملصق غيار زيت قديم على الزجاج، آخر تاريخ فيه من زمان', g: 'T:oil' },
  { t: 'غطا الزيت من داخل عليه طبقة سودا', g: 'T:oil' },
  { t: 'ملصق أسطول مقلوع وباقي أثر الغرا', g: 'T:rental' },
  { t: 'البلوتوث فيه أسماء جوالات كثيرة من ناس مختلفين', g: 'T:rental' },
  { t: 'أثر ملصق رقم جانبي على الباب، واللون حوله أغمق', g: 'T:taxi' },
  { t: 'الكرسي الخلفي اليمين أمسح من الباقي', g: 'T:taxi' },
  { t: 'ملصق جهة حكومية مقشور من الزجاج', g: 'T:gov' },
  { t: 'رقم عهدة محفور على الطبلون', g: 'T:gov' },
  { t: 'البراغي اللي تمسك الكبوت عليها أثر مفتاح', g: 'T:chassis' },
  { t: 'الصدام ما يركب على الرفرف مثل الجهة الثانية', g: 'T:chassis' },
  { t: 'تحت الأبواب أثر صدا خفيف على الحافة', g: 'T:rust' },
  { t: 'حرف الشنطة عليه فقاعات تحت الصبغ', g: 'T:rust' },
  { t: 'تحتها كله ممسوح ومرشوش، أنظف من عمرها', g: 'T:masked' },
  { t: 'جهاز الفحص يقول الحساسات مو جاهزة', g: 'T:masked' },
  { t: 'شبكة الهوا الأمامية مغسولة وفيها رمل محشور', g: 'T:desert' },
  { t: 'فلتر الهوا فيه رمل ناعم أكثر من الطبيعي', g: 'T:desert' },
  { t: 'لمبة الإيرباق تطفي متأخرة شوي بعد التشغيل', g: 'T:airbags' },
  { t: 'غطاء الإيرباق في الدركسون لونه أجدد من الطبلون', g: 'T:airbags' },
  { t: 'العداد يبدأ بالميل في الإعدادات', g: 'T:miles' },
  { t: 'أرقام العداد الصغيرة مكتوبة بالميل', g: 'T:miles' },
  { t: 'براغي العداد عليها أثر فك', g: 'T:odometer' },
  { t: 'الدركسون والدواسات تعبانة أكثر مما يقول العداد', g: 'T:odometer' },
  { t: 'لمبة المكينة تولع ثانية وتطفي', g: 'T:catalyst' },
  { t: 'صوت العادم فيه خشونة من تحت', g: 'T:catalyst' },
  { t: 'براغي الشنطة عليها أثر فك', g: 'T:najm' },
  { t: 'شعار الفئة على الشنطة مركّب برا، وثقوبه ما تطابق', g: 'T:trim' },
  { t: 'الكمبروسر يطقطق أول ما يشتغل المكيف', g: 'T:ac' },
  { t: 'الكفرات عليها شقوق خفيفة من الشمس', g: 'T:tyres_old' },
  { t: 'تاريخ الصنع على جنب الكفر قديم على شكلها', g: 'T:tyres_old' },
  { t: 'المكيف الخلفي يطلع هوا بس ما يبرد', g: 'ac' },
  { t: 'برودة الفتحات تنزل ببطء، تبي دقايق', g: 'ac' },
  // good surprises leave marks too
  { t: 'كتيب الوكالة كامل وأختامه مرتبة', g: 'T:history' },
  { t: 'ملف فواتير الوكالة كامل، مرتب بالتاريخ', g: 'T:freeservice' },
  { t: 'شهادة الضمان للحين في جيب الكتيب', g: 'T:warranty' },
  { t: 'لاصق حماية شفاف على العتبات من يوم الشراء', g: 'T:ppf' },
  { t: 'الدواسات وجلد الدركسون شبه جديدة', g: 'T:lowkm' },
  { t: 'ملصق الوكالة السعودية تحت الكبوت', g: 'T:spec' },
  { t: 'فاتورة قير جديدة في الدرج', g: 'T:gearbox_new' },
  { t: 'في الشنطة كرتون مسكّر مكتوب عليه أصلي', g: 'T:originals' },
  { t: 'عند حافة الباب يبان لون ثاني تحت التغليف', g: 'T:wrap' },
];

/** a painted-panel tell names a panel that really was touched */
export const PAINT_TELLS = [
  'لمعة {panel} غير عن اللي جنبه',
  'على مطاط {panel} رذاذ صبغ خفيف',
  'لون {panel} أفتح بدرجة في الشمس',
  'أثر شريط تلبيس عند حافة {panel}',
  'في {panel} حبيبات غبار تحت الصبغ',
];

export const PANEL_NAME: Record<string, string> = {
  fb: 'الصدام الأمامي', hood: 'الكبوت', roof: 'السقف', trunk: 'الشنطة', rb: 'الصدام الخلفي',
  lff: 'الرفرف الأمامي اليسار', lfd: 'الباب الأمامي اليسار', lrd: 'الباب الخلفي اليسار', lrq: 'الرفرف الخلفي اليسار',
  rff: 'الرفرف الأمامي اليمين', rfd: 'الباب الأمامي اليمين', rrd: 'الباب الخلفي اليمين', rrq: 'الرفرف الخلفي اليمين',
};
