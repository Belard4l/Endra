"use client";
/**
 * Lightweight translations (English + Kinyarwanda).
 * Add keys to BOTH dictionaries. Kinyarwanda strings should be reviewed by a
 * native speaker before launch.
 */
import React, { createContext, useContext, useEffect, useState } from "react";

const en = {
  "nav.home": "Home",
  "nav.services": "Services",
  "nav.providers": "Providers",
  "nav.howItWorks": "How it works",
  "nav.becomeProvider": "Become a provider",
  "nav.bookings": "My bookings",
  "nav.saved": "Saved",
  "nav.basket": "Basket",
  "nav.account": "Account",
  "nav.login": "Sign in",
  "nav.logout": "Log out",
  "nav.notifications": "Notifications",
  "search.placeholder": "Search venues, photographers, caterers…",
  "search.button": "Search",
  "hero.title": "Plan your whole wedding in one place",
  "hero.subtitle": "Find, book and pay trusted wedding providers across Rwanda. Your money is held safely until each service is delivered.",
  "hero.cta": "Browse services",
  "home.categories": "Browse by category",
  "home.plan": "Tell us about your wedding",
  "home.planHelp": "We'll suggest providers who are free on your day, in your area and within your budget.",
  "home.recommended": "Recommended for you",
  "home.topProviders": "Top providers",
  "home.latest": "New on HUZA",
  "home.how.1.title": "Choose your services",
  "home.how.1.text": "Compare listings, prices and reviews, then add what you need to your basket with your date and time.",
  "home.how.2.title": "Pay safely",
  "home.how.2.text": "Pay by MoMo or card — in full or with a deposit. HUZA holds the money, not the provider.",
  "home.how.3.title": "Celebrate",
  "home.how.3.text": "Providers are paid only after they deliver. If something goes wrong, we refund or find a replacement.",
  "field.date": "Wedding date",
  "field.district": "District",
  "field.budget": "Budget per service (RWF)",
  "field.startTime": "Start time",
  "field.notes": "Notes for the provider",
  "field.location": "Event location (venue & address)",
  "field.phone": "Phone number (for SMS updates)",
  "action.addToBasket": "Add to basket",
  "action.save": "Save",
  "action.saved": "Saved",
  "action.checkout": "Continue to payment",
  "action.checkDate": "Check date",
  "action.suggest": "Get suggestions",
  "action.viewAll": "View all",
  "basket.title": "Your basket",
  "basket.empty": "Your basket is empty",
  "basket.plan": "How would you like to pay?",
  "basket.full": "Pay in full now",
  "basket.deposit": "Pay a deposit now, the balance later",
  "basket.bookingFee": "Booking fee",
  "basket.dueNow": "Due now",
  "basket.total": "Total",
  "safety.title": "Book on HUZA to stay protected",
  "safety.text": "Bookings made outside HUZA have no payment protection, no refunds and no replacement if a provider cancels.",
  "filters.title": "Filters",
  "filters.category": "Category",
  "filters.all": "All",
  "filters.price": "Price (RWF)",
  "filters.sort": "Sort by",
  "filters.apply": "Apply",
  "filters.clear": "Clear",
  "sort.recommended": "Recommended",
  "sort.price_asc": "Price: low to high",
  "sort.price_desc": "Price: high to low",
  "sort.rating": "Top rated",
  "sort.newest": "Newest",
  "common.loading": "Loading…",
  "common.from": "From",
  "common.reviews": "reviews",
  "common.weddings": "weddings delivered",
  "common.verified": "Verified",
  "footer.tagline": "Wedding services, booked safely.",
};

type Dict = typeof en;
type Key = keyof Dict;

const rw: Dict = {
  "nav.home": "Ahabanza",
  "nav.services": "Serivisi",
  "nav.providers": "Abatanga serivisi",
  "nav.howItWorks": "Uko bikora",
  "nav.becomeProvider": "Tanga serivisi",
  "nav.bookings": "Ibyo nasabye",
  "nav.saved": "Ibyo nabitse",
  "nav.basket": "Agaseke",
  "nav.account": "Konti",
  "nav.login": "Injira",
  "nav.logout": "Sohoka",
  "nav.notifications": "Ubutumwa",
  "search.placeholder": "Shakisha ahabera ibirori, abafotora, ibiryo…",
  "search.button": "Shakisha",
  "hero.title": "Tegura ubukwe bwawe bwose ahantu hamwe",
  "hero.subtitle": "Shaka, uhitemo kandi wishyure abatanga serivisi z'ubukwe bizewe mu Rwanda hose. Amafaranga yawe abikwa neza kugeza serivisi itanzwe.",
  "hero.cta": "Reba serivisi",
  "home.categories": "Hitamo icyiciro",
  "home.plan": "Tubwire iby'ubukwe bwawe",
  "home.planHelp": "Tuzakwereka abatanga serivisi baboneka ku munsi wawe, hafi yawe kandi bijyanye n'ingengo y'imari yawe.",
  "home.recommended": "Ibyo tugusabira",
  "home.topProviders": "Abatanga serivisi b'imena",
  "home.latest": "Ibishya kuri HUZA",
  "home.how.1.title": "Hitamo serivisi",
  "home.how.1.text": "Gereranya serivisi, ibiciro n'ibitekerezo by'abandi, hanyuma ushyire ibyo ukeneye mu gaseke hamwe n'itariki n'isaha.",
  "home.how.2.title": "Ishyura mu mutekano",
  "home.how.2.text": "Ishyura ukoresheje MoMo cyangwa ikarita — yose icyarimwe cyangwa ubanje gutanga avansi. HUZA ni yo ibika amafaranga.",
  "home.how.3.title": "Ishimire ubukwe",
  "home.how.3.text": "Abatanga serivisi bishyurwa ari uko bamaze kuyitanga. Nihagira ikibazo, turagusubiza amafaranga cyangwa tukagushakira undi.",
  "field.date": "Itariki y'ubukwe",
  "field.district": "Akarere",
  "field.budget": "Ingengo y'imari kuri serivisi (RWF)",
  "field.startTime": "Isaha yo gutangira",
  "field.notes": "Icyo wabwira utanga serivisi",
  "field.location": "Aho ibirori bizabera (izina n'aderesi)",
  "field.phone": "Nimero ya telefoni (ubutumwa bugufi)",
  "action.addToBasket": "Shyira mu gaseke",
  "action.save": "Bika",
  "action.saved": "Byabitswe",
  "action.checkout": "Komeza wishyure",
  "action.checkDate": "Reba itariki",
  "action.suggest": "Mbona inama",
  "action.viewAll": "Reba byose",
  "basket.title": "Agaseke kawe",
  "basket.empty": "Agaseke kawe ntikarimo ikintu",
  "basket.plan": "Wifuza kwishyura ute?",
  "basket.full": "Ishyura yose ubu",
  "basket.deposit": "Tanga avansi ubu, asigaye nyuma",
  "basket.bookingFee": "Amafaranga yo kubika",
  "basket.dueNow": "Ayo wishyura ubu",
  "basket.total": "Igiteranyo",
  "safety.title": "Koresha HUZA kugira ngo urindwe",
  "safety.text": "Ibyumvikanyweho hanze ya HUZA ntibirinzwe: nta gusubizwa amafaranga, nta wundi ugusimbura niba utanga serivisi yisubiyeho.",
  "filters.title": "Muyunguruzi",
  "filters.category": "Icyiciro",
  "filters.all": "Byose",
  "filters.price": "Igiciro (RWF)",
  "filters.sort": "Tondeka",
  "filters.apply": "Emeza",
  "filters.clear": "Siba",
  "sort.recommended": "Ibyatoranyijwe",
  "sort.price_asc": "Igiciro: gito ujya hejuru",
  "sort.price_desc": "Igiciro: kinini ujya hasi",
  "sort.rating": "Ibyakunzwe cyane",
  "sort.newest": "Ibishya",
  "common.loading": "Tegereza…",
  "common.from": "Guhera kuri",
  "common.reviews": "ibitekerezo",
  "common.weddings": "ubukwe bwakozwe",
  "common.verified": "Yagenzuwe",
  "footer.tagline": "Serivisi z'ubukwe, zisabwa mu mutekano.",
};

export type Lang = "en" | "rw";
const dictionaries: Record<Lang, Dict> = { en, rw };

const I18nContext = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: Key) => string }>({
  lang: "en",
  setLang: () => undefined,
  t: (k) => en[k],
});

export const I18nProvider = ({ children }: { children: React.ReactNode }) => {
  const [lang, setLangState] = useState<Lang>("en");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("huza-lang");
      if (saved === "rw" || saved === "en") setLangState(saved);
    } catch {
      /* storage unavailable */
    }
  }, []);
  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem("huza-lang", l);
    } catch {
      /* ignore */
    }
    document.documentElement.lang = l;
  };
  const t = (k: Key) => dictionaries[lang][k] ?? en[k] ?? k;
  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
};

export const useI18n = () => useContext(I18nContext);
