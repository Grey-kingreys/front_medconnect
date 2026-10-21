/**
 * Schémas de validation des 5 envois du carnet de santé (consultation, ordonnance,
 * vaccination, analyse, rendez-vous), vérifiés avant l'envoi dans api_carnet.ts.
 *
 * Source de vérité : DTO du back,
 * back_medconnect/src/carnet-sante/dto/carnet-sante.dto.ts
 * (CreateConsultationDto, CreateOrdonnanceDto, CreateVaccinationDto,
 * CreateResultatAnalyseDto, CreateRendezVousDto).
 *
 * Règle : ne JAMAIS être plus strict que le back, sinon on bloque des envois
 * légitimes. Les contraintes reprennent celles de class-validator à l'identique :
 * - @IsOptional accepte aussi null, d'où `.nullish()` ;
 * - @IsDateString reprend le motif ISO 8601 de validator.js (13.15) ;
 * - @Length compte les caractères comme validator.js (voir `longueur`) ;
 * - @IsUUID est couvert par `z.guid()`, plus souple que le back.
 * À garder synchronisé à chaque modification de ces DTO.
 *
 * Messages en français, vocabulaire de l'utilisateur : ils peuvent être affichés.
 */
import { z } from "zod";

// Motif ISO 8601 de validator.js (isISO8601, mode non strict), utilisé par @IsDateString.
const ISO8601 =
  /^([\+-]?\d{4}(?!\d{2}\b))((-?)((0[1-9]|1[0-2])(\3([12]\d|0[1-9]|3[01]))?|W([0-4]\d|5[0-3])(-?[1-7])?|(00[1-9]|0[1-9]\d|[12]\d{2}|3([0-5]\d|6[1-6])))([T\s]((([01]\d|2[0-3])((:?)[0-5]\d)?|24:?00)([\.,]\d+(?!:))?)?(\17[0-5]\d([\.,]\d+)?)?([zZ]|([\+-])([01]\d|2[0-3]):?([0-5]\d)?)?)?)?$/;

// Longueur au sens de validator.js (isLength) : un emoji ou un caractère avec
// sélecteur de variante compte pour un seul caractère.
function longueur(texte: string): number {
  const variantes = texte.match(/[^️︎][️︎]/g) || [];
  const pairesSubstitution = texte.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g) || [];
  return texte.length - variantes.length - pairesSubstitution.length;
}

// Équivalent de @IsString() (+ @Length(min, max) si fourni).
const texte = (messageType: string, bornes?: { min: number; max: number; message: string }) => {
  const schema = z.string({ error: messageType });
  if (!bornes) return schema;
  return schema.refine(
    (valeur) => longueur(valeur) >= bornes.min && longueur(valeur) <= bornes.max,
    { error: bornes.message },
  );
};

// Équivalent de @IsNotEmpty() @IsString() (+ @Length(min, max) si fourni).
const texteObligatoire = (
  messageVide: string,
  bornes?: { min: number; max: number; message: string },
) => {
  const schema = z.string({ error: messageVide }).min(1, { error: messageVide });
  if (!bornes) return schema;
  return schema.refine(
    (valeur) => longueur(valeur) >= bornes.min && longueur(valeur) <= bornes.max,
    { error: bornes.message },
  );
};

// Équivalent de @IsDateString().
const date = (message: string) => z.string({ error: message }).regex(ISO8601, { error: message });

const PATIENT = "Le patient sélectionné n'est pas reconnu. Rouvrez son carnet puis réessayez.";
const STRUCTURE = "L'établissement sélectionné n'est pas reconnu. Choisissez-le de nouveau.";
const NOTES = "Les notes doivent être du texte.";

// ─── Consultation (CreateConsultationDto) ─────────────────────────────────────

export const consultationSchema = z.object({
  motif: texteObligatoire("Indiquez le motif de la consultation.", {
    min: 3,
    max: 500,
    message: "Le motif de la consultation doit contenir entre 3 et 500 caractères.",
  }),
  patientId: texte(PATIENT).nullish(),
  medecinNom: texte("Le nom du médecin doit être du texte.", {
    min: 0,
    max: 150,
    message: "Le nom du médecin ne doit pas dépasser 150 caractères.",
  }).nullish(),
  diagnostic: texte("Le diagnostic doit être du texte.", {
    min: 0,
    max: 500,
    message: "Le diagnostic ne doit pas dépasser 500 caractères.",
  }).nullish(),
  notes: texte(NOTES, {
    min: 0,
    max: 2000,
    message: "Les notes ne doivent pas dépasser 2000 caractères.",
  }).nullish(),
  dateConsultation: date("Indiquez une date de consultation valide.").nullish(),
  structureId: texte(STRUCTURE).nullish(),
});

// ─── Ordonnance (CreateOrdonnanceDto) ─────────────────────────────────────────

export const ordonnanceSchema = z.object({
  consultationId: texte("La consultation liée n'est pas reconnue. Choisissez-la de nouveau.").nullish(),
  medecinNom: texte("Le nom du médecin doit être du texte.").nullish(),
  // Le back attend une LISTE (@IsArray), qu'il enregistre lui-même sous forme de texte.
  // Le contenu des lignes n'est pas vérifié par le back (pas de @ValidateNested) :
  // on ne fige pas leur forme ici (le niveau P2 y ajoutera un médicament du catalogue).
  medicaments: z.array(z.unknown(), { error: "Ajoutez les médicaments de l'ordonnance." }),
  patientId: texte(PATIENT).nullish(),
  notes: texte(NOTES).nullish(),
  dateExpiration: date("Indiquez une date d'expiration valide.").nullish(),
  scanFileId: z
    .guid({ error: "L'ordonnance scannée n'a pas été reconnue. Ajoutez-la de nouveau." })
    .nullish(),
});

// ─── Vaccination (CreateVaccinationDto) ───────────────────────────────────────

export const vaccinationSchema = z.object({
  vaccin: texteObligatoire("Indiquez le nom du vaccin.", {
    min: 2,
    max: 200,
    message: "Le nom du vaccin doit contenir entre 2 et 200 caractères.",
  }),
  patientId: texte(PATIENT).nullish(),
  dateVaccin: date("Indiquez une date de vaccination valide."),
  prochainRappel: date("Indiquez une date de rappel valide, ou laissez le champ vide.").nullish(),
  lotNumero: texte("Le numéro de lot doit être du texte.").nullish(),
  administrePar: texte("Le nom de la personne qui a vacciné doit être du texte.").nullish(),
  notes: texte(NOTES).nullish(),
});

// ─── Résultat d'analyse (CreateResultatAnalyseDto) ────────────────────────────

export const analyseSchema = z.object({
  typeAnalyse: texteObligatoire("Indiquez le type d'analyse.", {
    min: 2,
    max: 200,
    message: "Le type d'analyse doit contenir entre 2 et 200 caractères.",
  }),
  patientId: texte(PATIENT).nullish(),
  laboratoire: texte("Le nom du laboratoire doit être du texte.", {
    min: 0,
    max: 200,
    message: "Le nom du laboratoire ne doit pas dépasser 200 caractères.",
  }).nullish(),
  resultats: texteObligatoire("Indiquez les résultats de l'analyse."),
  documentFileId: z
    .guid({ error: "Le document d'analyse n'a pas été reconnu. Ajoutez-le de nouveau." })
    .nullish(),
  dateAnalyse: date("Indiquez une date d'analyse valide."),
  notes: texte(NOTES).nullish(),
});

// ─── Rendez-vous (CreateRendezVousDto) ────────────────────────────────────────

export const rendezVousSchema = z.object({
  date: date("Indiquez une date de rendez-vous valide."),
  motif: texteObligatoire("Indiquez le motif du rendez-vous.", {
    min: 3,
    max: 500,
    message: "Le motif du rendez-vous doit contenir entre 3 et 500 caractères.",
  }),
  notes: texte(NOTES).nullish(),
  patientId: texteObligatoire("Choisissez le patient concerné par le rendez-vous."),
  structureId: texte(STRUCTURE).nullish(),
  medecinId: texte("Le médecin sélectionné n'est pas reconnu. Choisissez-le de nouveau.").nullish(),
  status: z
    .enum(["PROGRAMME", "CONFIRME", "ANNULE", "TERMINE", "EN_ATTENTE", "REFUSE"], {
      error: "Le statut du rendez-vous n'est pas reconnu.",
    })
    .nullish(),
});

export type ConsultationInput = z.infer<typeof consultationSchema>;
export type OrdonnanceInput = z.infer<typeof ordonnanceSchema>;
export type VaccinationInput = z.infer<typeof vaccinationSchema>;
export type AnalyseInput = z.infer<typeof analyseSchema>;
export type RendezVousInput = z.infer<typeof rendezVousSchema>;

/**
 * Vérifie un envoi avant de l'adresser au back. En cas d'échec, lève une Error
 * portant le premier message lisible du schéma (jamais le détail technique).
 */
export function validerEnvoi(schema: z.ZodType, data: unknown): void {
  const resultat = schema.safeParse(data);
  if (!resultat.success) {
    throw new Error(
      resultat.error.issues[0]?.message ?? "Certaines informations sont incomplètes. Vérifiez le formulaire.",
    );
  }
}
