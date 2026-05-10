import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import nlWidget from "./locales/nl/widget.json";
import enWidget from "./locales/en/widget.json";
import deWidget from "./locales/de/widget.json";
import frWidget from "./locales/fr/widget.json";

import nlManage from "./locales/nl/manage.json";
import enManage from "./locales/en/manage.json";
import deManage from "./locales/de/manage.json";
import frManage from "./locales/fr/manage.json";

import nlCommon from "./locales/nl/common.json";
import enCommon from "./locales/en/common.json";
import deCommon from "./locales/de/common.json";
import frCommon from "./locales/fr/common.json";

import type { Locale } from "./detectLocale";

if (!i18n.isInitialized) {
  i18n
    .use(initReactI18next)
    .init({
      resources: {
        nl: { widget: nlWidget, manage: nlManage, common: nlCommon },
        en: { widget: enWidget, manage: enManage, common: enCommon },
        de: { widget: deWidget, manage: deManage, common: deCommon },
        fr: { widget: frWidget, manage: frManage, common: frCommon },
      },
      lng: "nl",
      fallbackLng: "nl",
      defaultNS: "widget",
      ns: ["widget", "manage", "common"],
      interpolation: { escapeValue: false },
      react: { useSuspense: false },
    });
}

export async function setI18nLocale(locale: Locale): Promise<void> {
  if (i18n.language !== locale) {
    await i18n.changeLanguage(locale);
  }
}

export { default as i18n } from "i18next";
