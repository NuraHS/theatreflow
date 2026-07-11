export const SPECIALTY_CONSULTANTS = {
  Urology: [
    "Mr Shahzad Ahmad",
    "Mr Deji Akiboye",
    "Mr Philip Brousil",
    "Mr Randeep Dhariwal",
    "Mr Nick Faure-Walker",
    "Mr Stephen Gordon",
    "Mr Pieter Le Roux",
    "Mr Subha Mukherjee",
    "Miss Tharani Nitkunan",
    "Miss Sophie Rintoul-Hoad",
    "Mr Roger Walker",
    "Mr Simon Wong",
    "Locum / Other"
  ],
  "General Surgery": [
    "Mr Nick West",
    "Mr Nigel Day",
    "Mr Ashraf Raja",
    "Mr Ash Gupta",
    "Mr Nikhil Ladwa",
    "Mr Tou-pin Chang",
    "Mr Karim Jamal",
    "Mr Abdulazeez Bello",
    "Mr Trystan Lewis",
    "Miss Jenny Choi",
    "Miss Caroline Baillie",
    "Miss Lavanya Varatharajan",
    "Locum / Other"
  ],
  "Trauma and orthopaedics": [
    "Mr Sohail Yousaf",
    "Miss Andrea Sott",
    "Mr Christopher Hulme",
    "Mr Feroz Dinah",
    "Mr Najab Ellahee",
    "Mr Paul Hamilton",
    "Mr Nick Little",
    "Mr William McClatchie",
    "Mr Markus baker",
    "Mr Jonathan Craik",
    "Locum/other"
  ],
  "Obstetrics and gynaecology": [
    "Mr Pandelis Athanasias",
    "Mr Demetri Panayi",
    "Miss Zainab Khan",
    "Mr Yalandu Suresh",
    "Miss Lubna Haque",
    "Miss Latika Narang",
    "Miss Sangeetha Devarajan",
    "Miss Vishalli Ghai"
  ]
} as const;

export type SupportedSpecialty = keyof typeof SPECIALTY_CONSULTANTS;

export const SUPPORTED_SPECIALTIES = Object.keys(SPECIALTY_CONSULTANTS) as SupportedSpecialty[];

export const FREE_TEXT_OPERATION = "__free_text_operation__";

export const SPECIALTY_OPERATIONS: Record<SupportedSpecialty, readonly string[]> = {
  Urology: [
    "Scrotal exploration",
    "Ureteric stent insertion",
    "Ureteroscopy +/- laser stone retrieval",
    "Rigid cystoscopy + bladder washout",
    "Cystoscopy + guidewire catheter insertion",
    "Repair of penile fracture"
  ],
  "General Surgery": [
    "Laparotomy +/- proceed",
    "Incision + drainage of abscess",
    "Laparoscopic cholecystectomy",
    "Strangulated inguinal/femoral hernia repair"
  ],
  "Trauma and orthopaedics": [
    "Aspiration / washout of infected joint",
    "Emergency fasciotomy",
    "Open reduction internal fixation (ORIF)",
    "Hip fracture repair - DHS / hemiarthroplasty"
  ],
  "Obstetrics and gynaecology": [
    "Evacuation of retained products of conception (ERPC)",
    "Laparoscopic hysterectomy",
    "Salvage of ectopic pregnancy",
    "Salvage of ovarian torsion",
    "Exploration of post natal/post operative haemorrhage",
    "Drainage of pelvic abscess",
    "Repair of vaginal/vulval trauma"
  ]
};

export function getConsultantsForSpecialty(specialty: string) {
  return SPECIALTY_CONSULTANTS[specialty as SupportedSpecialty] ?? [];
}

export function getOperationsForSpecialty(specialty: string) {
  return SPECIALTY_OPERATIONS[specialty as SupportedSpecialty] ?? [];
}
