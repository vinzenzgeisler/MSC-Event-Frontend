import { VEHICLE_IMAGE_MAX_DIMENSION_PIXELS, VEHICLE_IMAGE_MAX_FILE_SIZE_MB } from "@/config/public-upload-limits";

export type ApiErrorLocale = "de" | "en" | "cz" | "pl";

type ApiErrorDescriptor = {
  status?: number;
  code?: string;
  message?: string;
};

const apiErrorMessages: Record<ApiErrorLocale, Partial<Record<string, string>>> = {
  de: {
    VALIDATION_ERROR: "Bitte prüfe deine Eingaben.",
    UNAUTHORIZED: "Authentifizierung fehlgeschlagen.",
    FORBIDDEN: "Für diese Aktion fehlen die Berechtigungen.",
    NOT_FOUND: "Der angeforderte Datensatz wurde nicht gefunden.",
    CONFLICT: "Die Aktion konnte wegen eines Konflikts nicht abgeschlossen werden.",
    RATE_LIMITED: "Zu viele Anfragen. Bitte kurz warten und erneut versuchen.",
    INTERNAL_ERROR: "Der Vorgang konnte derzeit nicht abgeschlossen werden.",
    NETWORK_ERROR: "Die Verbindung zum Server ist gerade nicht verfügbar.",
    EVENT_NOT_OPEN: "Für dieses Event ist derzeit keine Anmeldung möglich.",
    REGISTRATION_NOT_OPEN: "Die Anmeldung ist noch nicht geöffnet.",
    REGISTRATION_CLOSED: "Die Anmeldung ist bereits geschlossen.",
    EVENT_NOT_FOUND: "Das Event wurde nicht gefunden.",
    CLASS_NOT_FOUND: "Die ausgewählte Klasse wurde nicht gefunden.",
    CLASS_VEHICLE_TYPE_MISMATCH: "Die ausgewählte Klasse passt nicht zum Fahrzeugtyp.",
    BACKUP_ENTRY_NOT_FOUND: "Die verknüpfte Nennung für das Ersatzfahrzeug wurde nicht gefunden.",
    BACKUP_ENTRY_INVALID_LINK: "Die Verknüpfung zum Ersatzfahrzeug ist ungültig.",
    EMAIL_ALREADY_IN_USE_ACTIVE_ENTRY:
      "Diese E-Mail ist bereits in einer aktiven Nennung hinterlegt. Bitte nutze eine andere E-Mail oder kontaktiere das Orga-Team.",
    EMAIL_ALREADY_USED_BY_DIFFERENT_PERSON:
      "Diese E-Mail-Adresse ist bereits einer anderen Person zugeordnet. Bitte nutze eine andere E-Mail oder kontaktiere das Orga-Team.",
    CONSENT_LOCALE_INVALID: "Die bestätigten Rechtstexte sind ungültig. Bitte Seite neu laden und erneut versuchen.",
    CONSENT_VERSION_MISMATCH: "Die Rechtstexte haben sich geändert. Bitte Seite neu laden und erneut bestätigen.",
    IMAGE_UPLOAD_INVALID: "Bild-Upload ist ungültig oder abgelaufen. Bitte Fahrzeugbilder erneut hochladen.",
    REGISTRATION_CONFIRMATION_QUEUE_FAILED:
      "Anmeldung gespeichert, aber die Bestätigungs-Mail konnte nicht eingeplant werden. Bitte Support kontaktieren.",
    VERIFY_TOKEN_INVALID: "Der Verifizierungslink ist ungültig oder abgelaufen.",
    VERIFY_TOKEN_EXPIRED: "Der Verifizierungslink ist abgelaufen. Bitte fordere eine neue Verifizierungs-Mail an.",
    VERIFY_TOKEN_ALREADY_USED: "Die E-Mail ist bereits verifiziert.",
    VERIFY_ALREADY_COMPLETED: "Die E-Mail ist bereits verifiziert.",
    VERIFICATION_RESEND_QUEUE_FAILED: "Die Verifizierungs-Mail konnte gerade nicht erneut versendet werden. Bitte später erneut versuchen.",
    UPLOAD_FILE_TOO_LARGE: `Bild ist zu groß. Maximal ${VEHICLE_IMAGE_MAX_FILE_SIZE_MB} MB sind erlaubt.`,
    UPLOAD_DIMENSIONS_TOO_LARGE:
      `Bild ist in den Abmessungen zu groß. Maximal ${VEHICLE_IMAGE_MAX_DIMENSION_PIXELS} × ${VEHICLE_IMAGE_MAX_DIMENSION_PIXELS} Pixel sind erlaubt.`,
    UPLOAD_CONTENT_INVALID: "Das Bild ist ungültig. Bitte JPG, PNG oder WEBP in normaler Auflösung verwenden.",
    UPLOAD_CONTENT_TYPE_MISMATCH: "Das Bild passt nicht zum angegebenen Dateityp. Bitte JPG, PNG oder WEBP erneut hochladen.",
    UPLOAD_NOT_FOUND: "Der Bild-Upload wurde nicht gefunden. Bitte das Bild erneut hochladen.",
    UPLOAD_TOKEN_INVALID: "Der Bild-Upload ist ungültig. Bitte das Bild erneut hochladen.",
    UPLOAD_EXPIRED: "Der Bild-Upload ist abgelaufen. Bitte das Bild erneut hochladen.",
    UPLOAD_OBJECT_MISSING: "Das hochgeladene Bild wurde nicht gefunden. Bitte das Bild erneut hochladen.",
    UNSUPPORTED_IMAGE_TYPE: "Dateityp nicht unterstützt. Bitte JPG, PNG oder WEBP verwenden.",
    UPLOAD_PUT_FAILED: "Bild-Upload fehlgeschlagen. Bitte erneut versuchen."
  },
  en: {
    VALIDATION_ERROR: "Please check your entries.",
    UNAUTHORIZED: "Authentication failed.",
    FORBIDDEN: "You do not have permission for this action.",
    NOT_FOUND: "The requested record could not be found.",
    CONFLICT: "The action could not be completed because of a conflict.",
    RATE_LIMITED: "Too many requests. Please wait a moment and try again.",
    INTERNAL_ERROR: "The action could not be completed right now.",
    NETWORK_ERROR: "The connection to the server is currently unavailable.",
    EVENT_NOT_OPEN: "Registration is currently not available for this event.",
    REGISTRATION_NOT_OPEN: "Registration has not opened yet.",
    REGISTRATION_CLOSED: "Registration is already closed.",
    EVENT_NOT_FOUND: "The event could not be found.",
    CLASS_NOT_FOUND: "The selected class could not be found.",
    CLASS_VEHICLE_TYPE_MISMATCH: "The selected class does not match the vehicle type.",
    BACKUP_ENTRY_NOT_FOUND: "The linked backup entry could not be found.",
    BACKUP_ENTRY_INVALID_LINK: "The backup vehicle link is invalid.",
    EMAIL_ALREADY_IN_USE_ACTIVE_ENTRY:
      "This email is already used in an active entry. Please use a different email or contact the event team.",
    EMAIL_ALREADY_USED_BY_DIFFERENT_PERSON:
      "This email address is already linked to a different person. Please use a different email or contact the event team.",
    CONSENT_LOCALE_INVALID: "The confirmed legal texts are invalid. Please reload the page and try again.",
    CONSENT_VERSION_MISMATCH: "The legal texts changed. Please reload the page and confirm them again.",
    IMAGE_UPLOAD_INVALID: "The image upload is invalid or expired. Please upload the vehicle images again.",
    REGISTRATION_CONFIRMATION_QUEUE_FAILED:
      "The registration was saved, but the confirmation email could not be queued. Please contact support.",
    VERIFY_TOKEN_INVALID: "The verification link is invalid or expired.",
    VERIFY_TOKEN_EXPIRED: "The verification link has expired. Please request a new verification email.",
    VERIFY_TOKEN_ALREADY_USED: "The email address is already verified.",
    VERIFY_ALREADY_COMPLETED: "The email address is already verified.",
    VERIFICATION_RESEND_QUEUE_FAILED: "The verification email could not be resent right now. Please try again later.",
    UPLOAD_FILE_TOO_LARGE: `The image is too large. A maximum of ${VEHICLE_IMAGE_MAX_FILE_SIZE_MB} MB is allowed.`,
    UPLOAD_DIMENSIONS_TOO_LARGE:
      `The image dimensions are too large. A maximum of ${VEHICLE_IMAGE_MAX_DIMENSION_PIXELS} × ${VEHICLE_IMAGE_MAX_DIMENSION_PIXELS} pixels is allowed.`,
    UPLOAD_CONTENT_INVALID: "The image is invalid. Please use a JPG, PNG or WEBP image with normal dimensions.",
    UPLOAD_CONTENT_TYPE_MISMATCH: "The image does not match the declared file type. Please upload JPG, PNG or WEBP again.",
    UPLOAD_NOT_FOUND: "The image upload could not be found. Please upload the image again.",
    UPLOAD_TOKEN_INVALID: "The image upload is invalid. Please upload the image again.",
    UPLOAD_EXPIRED: "The image upload has expired. Please upload the image again.",
    UPLOAD_OBJECT_MISSING: "The uploaded image could not be found. Please upload the image again.",
    UNSUPPORTED_IMAGE_TYPE: "Unsupported file type. Please use JPG, PNG or WEBP.",
    UPLOAD_PUT_FAILED: "Image upload failed. Please try again."
  },
  cz: {
    VALIDATION_ERROR: "Zkontrolujte prosím zadané údaje.",
    UNAUTHORIZED: "Ověření se nezdařilo.",
    FORBIDDEN: "Pro tuto akci nemáte oprávnění.",
    NOT_FOUND: "Požadovaný záznam nebyl nalezen.",
    CONFLICT: "Akci se nepodařilo dokončit kvůli konfliktu.",
    RATE_LIMITED: "Příliš mnoho požadavků. Chvíli počkejte a zkuste to znovu.",
    INTERNAL_ERROR: "Akci se teď nepodařilo dokončit.",
    NETWORK_ERROR: "Spojení se serverem je momentálně nedostupné.",
    EVENT_NOT_OPEN: "Registrace pro tuto akci není momentálně dostupná.",
    REGISTRATION_NOT_OPEN: "Registrace ještě nebyla otevřena.",
    REGISTRATION_CLOSED: "Registrace je již uzavřena.",
    EVENT_NOT_FOUND: "Akce nebyla nalezena.",
    CLASS_NOT_FOUND: "Vybraná třída nebyla nalezena.",
    CLASS_VEHICLE_TYPE_MISMATCH: "Vybraná třída neodpovídá typu vozidla.",
    BACKUP_ENTRY_NOT_FOUND: "Navázaná přihláška náhradního vozidla nebyla nalezena.",
    BACKUP_ENTRY_INVALID_LINK: "Odkaz na náhradní vozidlo je neplatný.",
    EMAIL_ALREADY_IN_USE_ACTIVE_ENTRY:
      "Tento e-mail je již použit v aktivní přihlášce. Použijte jiný e-mail nebo kontaktujte pořadatele.",
    EMAIL_ALREADY_USED_BY_DIFFERENT_PERSON:
      "Tato e-mailová adresa je již přiřazena jiné osobě. Použijte jiný e-mail nebo kontaktujte pořadatele.",
    CONSENT_LOCALE_INVALID: "Potvrzené právní texty jsou neplatné. Obnovte stránku a zkuste to znovu.",
    CONSENT_VERSION_MISMATCH: "Právní texty se změnily. Obnovte stránku a potvrďte je znovu.",
    IMAGE_UPLOAD_INVALID: "Nahrání obrázku je neplatné nebo vypršelo. Nahrajte prosím obrázky vozidla znovu.",
    REGISTRATION_CONFIRMATION_QUEUE_FAILED:
      "Registrace byla uložena, ale potvrzovací e-mail se nepodařilo zařadit do fronty. Kontaktujte podporu.",
    VERIFY_TOKEN_INVALID: "Ověřovací odkaz je neplatný nebo vypršel.",
    VERIFY_TOKEN_EXPIRED: "Ověřovací odkaz vypršel. Vyžádejte si nový ověřovací e-mail.",
    VERIFY_TOKEN_ALREADY_USED: "E-mailová adresa je již ověřena.",
    VERIFY_ALREADY_COMPLETED: "E-mailová adresa je již ověřena.",
    VERIFICATION_RESEND_QUEUE_FAILED: "Ověřovací e-mail teď nebylo možné znovu odeslat. Zkuste to prosím později.",
    UPLOAD_FILE_TOO_LARGE: `Obrázek je příliš velký. Maximálně je povoleno ${VEHICLE_IMAGE_MAX_FILE_SIZE_MB} MB.`,
    UPLOAD_DIMENSIONS_TOO_LARGE:
      `Rozměry obrázku jsou příliš velké. Maximum je ${VEHICLE_IMAGE_MAX_DIMENSION_PIXELS} × ${VEHICLE_IMAGE_MAX_DIMENSION_PIXELS} pixelů.`,
    UPLOAD_CONTENT_INVALID: "Obrázek je neplatný. Použijte JPG, PNG nebo WEBP v běžném rozlišení.",
    UPLOAD_CONTENT_TYPE_MISMATCH: "Obrázek neodpovídá zadanému typu souboru. Nahrajte prosím JPG, PNG nebo WEBP znovu.",
    UPLOAD_NOT_FOUND: "Nahraný obrázek nebyl nalezen. Nahrajte jej prosím znovu.",
    UPLOAD_TOKEN_INVALID: "Nahrání obrázku je neplatné. Nahrajte obrázek prosím znovu.",
    UPLOAD_EXPIRED: "Platnost nahrání obrázku vypršela. Nahrajte obrázek prosím znovu.",
    UPLOAD_OBJECT_MISSING: "Nahraný obrázek nebyl nalezen. Nahrajte jej prosím znovu.",
    UNSUPPORTED_IMAGE_TYPE: "Nepodporovaný typ souboru. Použijte JPG, PNG nebo WEBP.",
    UPLOAD_PUT_FAILED: "Nahrání obrázku se nezdařilo. Zkuste to prosím znovu."
  },
  pl: {
    VALIDATION_ERROR: "Sprawdź proszę wprowadzone dane.",
    UNAUTHORIZED: "Uwierzytelnienie nie powiodło się.",
    FORBIDDEN: "Nie masz uprawnień do tej akcji.",
    NOT_FOUND: "Nie znaleziono żądanego rekordu.",
    CONFLICT: "Nie udało się zakończyć akcji z powodu konfliktu.",
    RATE_LIMITED: "Zbyt wiele żądań. Odczekaj chwilę i spróbuj ponownie.",
    INTERNAL_ERROR: "Nie udało się teraz zakończyć tej akcji.",
    NETWORK_ERROR: "Połączenie z serwerem jest obecnie niedostępne.",
    EVENT_NOT_OPEN: "Rejestracja na to wydarzenie jest obecnie niedostępna.",
    REGISTRATION_NOT_OPEN: "Rejestracja nie została jeszcze otwarta.",
    REGISTRATION_CLOSED: "Rejestracja jest już zamknięta.",
    EVENT_NOT_FOUND: "Nie znaleziono wydarzenia.",
    CLASS_NOT_FOUND: "Nie znaleziono wybranej klasy.",
    CLASS_VEHICLE_TYPE_MISMATCH: "Wybrana klasa nie pasuje do typu pojazdu.",
    BACKUP_ENTRY_NOT_FOUND: "Nie znaleziono powiązanego zgłoszenia pojazdu zapasowego.",
    BACKUP_ENTRY_INVALID_LINK: "Powiązanie pojazdu zapasowego jest nieprawidłowe.",
    EMAIL_ALREADY_IN_USE_ACTIVE_ENTRY:
      "Ten adres e-mail jest już używany w aktywnym zgłoszeniu. Użyj innego adresu lub skontaktuj się z organizatorem.",
    EMAIL_ALREADY_USED_BY_DIFFERENT_PERSON:
      "Ten adres e-mail jest już przypisany do innej osoby. Użyj innego adresu lub skontaktuj się z organizatorem.",
    CONSENT_LOCALE_INVALID: "Potwierdzone teksty prawne są nieprawidłowe. Odśwież stronę i spróbuj ponownie.",
    CONSENT_VERSION_MISMATCH: "Teksty prawne uległy zmianie. Odśwież stronę i potwierdź je ponownie.",
    IMAGE_UPLOAD_INVALID: "Przesłanie obrazu jest nieprawidłowe lub wygasło. Prześlij zdjęcia pojazdu ponownie.",
    REGISTRATION_CONFIRMATION_QUEUE_FAILED:
      "Rejestracja została zapisana, ale nie udało się zaplanować e-maila potwierdzającego. Skontaktuj się ze wsparciem.",
    VERIFY_TOKEN_INVALID: "Link weryfikacyjny jest nieprawidłowy lub wygasł.",
    VERIFY_TOKEN_EXPIRED: "Link weryfikacyjny wygasł. Poproś o nowy e-mail weryfikacyjny.",
    VERIFY_TOKEN_ALREADY_USED: "Adres e-mail jest już zweryfikowany.",
    VERIFY_ALREADY_COMPLETED: "Adres e-mail jest już zweryfikowany.",
    VERIFICATION_RESEND_QUEUE_FAILED: "Nie udało się teraz ponownie wysłać e-maila weryfikacyjnego. Spróbuj ponownie później.",
    UPLOAD_FILE_TOO_LARGE: `Obraz jest zbyt duży. Maksymalnie dozwolone jest ${VEHICLE_IMAGE_MAX_FILE_SIZE_MB} MB.`,
    UPLOAD_DIMENSIONS_TOO_LARGE:
      `Wymiary obrazu są zbyt duże. Maksimum to ${VEHICLE_IMAGE_MAX_DIMENSION_PIXELS} × ${VEHICLE_IMAGE_MAX_DIMENSION_PIXELS} pikseli.`,
    UPLOAD_CONTENT_INVALID: "Obraz jest nieprawidłowy. Użyj JPG, PNG lub WEBP w normalnej rozdzielczości.",
    UPLOAD_CONTENT_TYPE_MISMATCH: "Obraz nie odpowiada zadeklarowanemu typowi pliku. Prześlij ponownie JPG, PNG lub WEBP.",
    UPLOAD_NOT_FOUND: "Nie znaleziono przesłanego obrazu. Prześlij obraz ponownie.",
    UPLOAD_TOKEN_INVALID: "Przesłanie obrazu jest nieprawidłowe. Prześlij obraz ponownie.",
    UPLOAD_EXPIRED: "Przesłanie obrazu wygasło. Prześlij obraz ponownie.",
    UPLOAD_OBJECT_MISSING: "Nie znaleziono przesłanego obrazu. Prześlij obraz ponownie.",
    UNSUPPORTED_IMAGE_TYPE: "Nieobsługiwany typ pliku. Użyj JPG, PNG lub WEBP.",
    UPLOAD_PUT_FAILED: "Przesyłanie obrazu nie powiodło się. Spróbuj ponownie."
  }
};

const normalizeApiErrorCode = (code?: string) => (code ?? "").trim().toUpperCase();

const isGenericApiMessage = (message: string, status: number): boolean => {
  const normalized = message.trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  if (normalized === `api request failed (${status})`.toLowerCase()) {
    return true;
  }
  return ["validation failed", "unauthorized", "forbidden", "not found", "too many requests", "conflict", "internal server error"].includes(
    normalized
  );
};

const isNetworkErrorMessage = (message: string): boolean => {
  const normalized = message.trim().toLowerCase();
  return (
    normalized.includes("failed to fetch") ||
    normalized.includes("networkerror") ||
    normalized.includes("network request failed") ||
    normalized.includes("load failed")
  );
};

const deriveCodeFromStatus = (status?: number): string => {
  if (status === 400) {
    return "VALIDATION_ERROR";
  }
  if (status === 401) {
    return "UNAUTHORIZED";
  }
  if (status === 403) {
    return "FORBIDDEN";
  }
  if (status === 404) {
    return "NOT_FOUND";
  }
  if (status === 409) {
    return "CONFLICT";
  }
  if (status === 429) {
    return "RATE_LIMITED";
  }
  if (typeof status === "number" && status >= 500) {
    return "INTERNAL_ERROR";
  }
  return "";
};

const getLocalizedCodeMessage = (code: string, locale: ApiErrorLocale): string | null => {
  if (!code) {
    return null;
  }
  return apiErrorMessages[locale][code] ?? apiErrorMessages.de[code] ?? null;
};

export function resolveApiErrorMessage(
  error: ApiErrorDescriptor,
  fallback = "Ein unerwarteter Fehler ist aufgetreten.",
  locale: ApiErrorLocale = "de"
) {
  const code = normalizeApiErrorCode(error.code) || deriveCodeFromStatus(error.status);
  const localized = getLocalizedCodeMessage(code, locale);
  if (localized) {
    return localized;
  }
  if (error.message && !isGenericApiMessage(error.message, error.status ?? 0)) {
    return error.message;
  }
  const statusFallback = getLocalizedCodeMessage(deriveCodeFromStatus(error.status), locale);
  if (statusFallback) {
    return statusFallback;
  }
  return error.message || fallback;
}

export function resolvePlainErrorMessage(
  message: string,
  fallback = "Ein unerwarteter Fehler ist aufgetreten.",
  locale: ApiErrorLocale = "de"
) {
  if (isNetworkErrorMessage(message)) {
    return getLocalizedCodeMessage("NETWORK_ERROR", locale) ?? fallback;
  }
  return message || fallback;
}
