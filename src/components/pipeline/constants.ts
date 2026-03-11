export const PIPELINE_STATUSES = [
  "nuovo",
  "contattato",
  "informazione",
  "notizia",
  "valutazione fissata",
  "valutazione effettuata",
  "incarico preso",
  "venduto",
  "non interessato",
  "da eliminare",
] as const;

export type PipelineStatus = (typeof PIPELINE_STATUSES)[number];