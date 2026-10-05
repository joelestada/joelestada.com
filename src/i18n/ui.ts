import { useLang } from './LangProvider';
import type { Lang } from './lang';
import { bilingual } from './localize';

/**
 * Textos de la interfaz (botones, rótulos, avisos y etiquetas para lectores de pantalla), en los dos
 * idiomas uno junto al otro. Los contenidos (proyectos, CV, perfil) viven en config/. Un texto con
 * datos dentro es una función en cada idioma.
 */
const UI_SRC = {
  meta: {
    disciplines: { en: 'Engineering × Data × Software', es: 'Ingeniería × Datos × Software' },
    description: {
      en: 'Industrial engineering student in Valencia, Spain: engineering, data and software. A portfolio built as a production line, where every machine is a project.',
      es: 'Estudiante de Ingeniería Industrial en Valencia: ingeniería, datos y software. Un portafolio hecho como una línea de producción, donde cada máquina es un proyecto.',
    },
    ogAlt: {
      en: (person: string) => `${person}: an isometric factory where every machine is a project`,
      es: (person: string) => `${person}: una fábrica isométrica donde cada máquina es un proyecto`,
    },
    h1: {
      en: (person: string) => `${person} — engineering, data and software portfolio`,
      es: (person: string) => `${person} — portafolio de ingeniería, datos y software`,
    },
    projectOgAlt: {
      en: (title: string, n: string) => `${title}, station ${n} of the line`,
      es: (title: string, n: string) => `${title}, estación ${n} de la línea`,
    },
    sheets: { en: 'Project sheets', es: 'Hojas de los proyectos' },
  },

  /** Lo que se repite en toda la web. */
  common: {
    theLine: { en: 'The line', es: 'La línea' },
    startOfLine: { en: 'Start of the line', es: 'Inicio de la línea' },
    endOfLine: { en: 'End of the line', es: 'Final de la línea' },
    backTo: { en: 'Back to', es: 'Volver a' },
    sheet: { en: 'Sheet', es: 'Hoja' },
    cv: { en: 'Curriculum vitae', es: 'Currículum' },
    contact: { en: 'Contact', es: 'Contacto' },
    emailCv: { en: 'Email · CV', es: 'Email · CV' },
    goTo: { en: 'Go to', es: 'Ir a' },
    exitAria: { en: 'End of the line: contact', es: 'Final de la línea: contacto' },
    goToExitAria: { en: 'Go to the end of the line: contact', es: 'Ir al final de la línea: contacto' },
    available: { en: 'Open to new projects', es: 'Disponible para nuevos proyectos' },
    exitTitle: { en: ['Open to', 'new projects'], es: ['Disponible para', 'nuevos proyectos'] },
    exitTitleOff: { en: ['Get in', 'touch'], es: ['Ponte en', 'contacto'] },
    copyEmail: { en: 'COPY EMAIL', es: 'COPIAR EMAIL' },
    copied: { en: 'COPIED', es: 'COPIADO' },
    copiedAria: { en: 'Email copied to clipboard', es: 'Email copiado al portapapeles' },
    write: { en: 'WRITE', es: 'ESCRIBIR' },
    seeOnLine: { en: 'See it on the line', es: 'Verlo en la línea' },
    sheetOf: {
      en: (n: string, total: string) => `SHEET ${n} / ${total}`,
      es: (n: string, total: string) => `HOJA ${n} / ${total}`,
    },
    close: { en: 'CLOSE', es: 'CERRAR' },
  },

  sections: {
    projects: { en: 'Projects', es: 'Proyectos' },
    about: { en: 'About', es: 'Sobre mí' },
    contact: { en: 'Contact', es: 'Contacto' },
    cv: { en: 'CV', es: 'CV' },
  },

  bar: {
    menu: { en: 'MENU', es: 'MENÚ' },
    close: { en: 'CLOSE', es: 'CERRAR' },
    openMenu: { en: 'Open menu', es: 'Abrir el menú' },
    closeMenu: { en: 'Close menu', es: 'Cerrar el menú' },
    sections: { en: 'Sections', es: 'Apartados' },
    breadcrumb: { en: 'Breadcrumb', es: 'Ruta' },
    menuAria: { en: 'Menu', es: 'Menú' },
    /** Botón de idioma: lo que dice y lo que lee un lector de pantalla. */
    langAria: { en: 'Ver la web en español', es: 'View the site in English' },
    savePdf: { en: 'Save as PDF', es: 'Guardar en PDF' },
  },

  /** Rótulos pintados en la nave (se pintan al montarla, con el idioma de la página). */
  scene: {
    shutter: { en: 'PORTFOLIO', es: 'PORTAFOLIO' },
    box: { en: 'OPEN TO NEW PROJECTS', es: 'ABIERTO A PROYECTOS' },
    /** Rótulo grande en la pared del final, junto a la puerta de salida (dos líneas). */
    wall: { en: ['OPEN TO', 'NEW PROJECTS'], es: ['ABIERTO A', 'PROYECTOS'] },
  },

  boot: {
    loading: { en: 'LOADING THE PLANT', es: 'CARGANDO LA PLANTA' },
    drawing: { en: 'DRAWING THE LINE', es: 'DIBUJANDO LA LÍNEA' },
    building: { en: 'BUILDING THE MACHINES', es: 'MONTANDO LAS MÁQUINAS' },
    powering: { en: 'POWERING ON', es: 'ENCENDIENDO' },
    running: { en: 'LINE RUNNING', es: 'LÍNEA EN MARCHA' },
  },

  rail: {
    cueDesk: { en: 'SCROLL TO EXPLORE', es: 'DESPLAZA PARA RECORRER' },
    cueTouch: { en: '← SWIPE TO EXPLORE', es: '← DESLIZA PARA RECORRER' },
    contact: { en: 'CONTACT', es: 'CONTACTO' },
    pause: { en: 'Pause the line', es: 'Parar la línea' },
    run: { en: 'Run the line', es: 'Poner en marcha la línea' },
    pauseTip: { en: 'PAUSE THE LINE', es: 'PARAR LA LÍNEA' },
    runTip: { en: 'RUN THE LINE', es: 'PONER EN MARCHA' },
    backToStart: { en: 'Back to the start of the line', es: 'Volver al inicio de la línea' },
    backToStartTip: { en: 'BACK TO START', es: 'VOLVER AL INICIO' },
    homeKey: { en: 'HOME', es: 'INICIO' },
  },

  card: {
    startLine: { en: 'START THE LINE', es: 'EMPEZAR LA LÍNEA' },
    holdTip: { en: 'Press and hold: full power', es: 'Mantén pulsado: plena potencia' },
    explode: { en: 'EXPLODED VIEW', es: 'VISTA EXPLOSIONADA' },
    assemble: { en: 'ASSEMBLE', es: 'MONTAR' },
    enter: { en: 'ENTER PROJECT', es: 'VER PROYECTO' },
    partsList: { en: 'Parts list', es: 'Lista de piezas' },
    endField: { en: 'END OF THE LINE', es: 'FINAL DE LA LÍNEA' },
    backToStart: { en: 'BACK TO START', es: 'VOLVER AL INICIO' },
    details: { en: 'DETAILS', es: 'DETALLES' },
    close: { en: 'CLOSE', es: 'CERRAR' },
    about: { en: 'ABOUT', es: 'SOBRE MÍ' },
    start: { en: 'START', es: 'INICIO' },
    end: { en: 'END', es: 'FIN' },
    introAria: { en: 'Introduction', es: 'Presentación' },
    contactAria: { en: 'Contact', es: 'Contacto' },
    projectAria: { en: 'Project', es: 'Proyecto' },
    aboutAria: { en: 'About Joel', es: 'Sobre Joel' },
    closeDetails: { en: 'Close the project details', es: 'Cerrar los detalles del proyecto' },
    openDetails: { en: 'Open the project details', es: 'Abrir los detalles del proyecto' },
    previous: { en: 'Previous', es: 'Anterior' },
    next: { en: 'Next', es: 'Siguiente' },
    stopStart: { en: 'start of the line', es: 'inicio de la línea' },
    stopEnd: { en: 'end of the line', es: 'final de la línea' },
  },

  drawer: {
    projectsLead: {
      en: 'Every machine on the line is a project. Pick one to walk to it.',
      es: 'Cada máquina de la línea es un proyecto. Elige una para ir hasta ella.',
    },
    contactLead: {
      en: 'Write directly, or copy the address. The line also ends here: the last stop is the way out.',
      es: 'Escríbeme directamente o copia la dirección. La línea también acaba aquí: la última parada es la salida.',
    },
    cvLead: {
      en: 'One page, A4: skills, languages, experience and studies. Read it here or save it as PDF.',
      es: 'Una página, A4: habilidades, idiomas, experiencia y estudios. Léelo aquí o guárdalo en PDF.',
    },
    basedIn: { en: 'BASED IN', es: 'RESIDENCIA' },
    timezone: { en: 'CET (UTC+1)', es: 'CET (UTC+1)' },
    availability: { en: 'STATUS', es: 'ESTADO' },
    studies: { en: 'STUDIES', es: 'ESTUDIOS' },
    studiesValue: { en: 'Industrial Technologies Eng. · UJI', es: 'Ing. en Tecnologías Industriales · UJI' },
    languages: { en: 'LANGUAGES', es: 'IDIOMAS' },
    format: { en: 'FORMAT', es: 'FORMATO' },
    openCv: { en: 'OPEN THE CV', es: 'ABRIR EL CV' },
    openCvAria: { en: 'Open the CV', es: 'Abrir el CV' },
    savePdf: { en: 'SAVE AS PDF', es: 'GUARDAR EN PDF' },
    keys: {
      stations: { en: 'Stations', es: 'Estaciones' },
      space: { en: 'Space', es: 'Espacio' },
      next: { en: 'Next', es: 'Siguiente' },
      home: { en: 'Home', es: 'Inicio' },
      end: { en: 'End', es: 'Fin' },
      startContact: { en: 'Start · Contact', es: 'Inicio · Contacto' },
      pause: { en: 'Pause the line', es: 'Parar la línea' },
      menu: { en: 'Menu', es: 'Menú' },
      close: { en: 'Close', es: 'Cerrar' },
    },
  },

  flat: {
    sheet: { en: 'The line · drawing set', es: 'La línea · juego de planos' },
    note: {
      en: 'This browser can’t draw the 3D plant, so the line is shown as a set of drawings. Open it with hardware acceleration on to walk through it.',
      es: 'Este navegador no puede dibujar la planta en 3D, así que la línea se muestra como un juego de planos. Ábrela con la aceleración por hardware activada para recorrerla.',
    },
  },

  index: {
    nextStation: { en: 'Next station', es: 'Siguiente estación' },
    stationOf: {
      en: (n: string, total: string) => `Station ${n} of ${total}`,
      es: (n: string, total: string) => `Estación ${n} de ${total}`,
    },
    stations: {
      en: (total: string) => `${total} stations and a way out`,
      es: (total: string) => `${total} estaciones y una salida`,
    },
  },

  project: {
    year: { en: 'YEAR', es: 'AÑO' },
    station: { en: 'STATION', es: 'ESTACIÓN' },
    sheet: { en: 'SHEET', es: 'HOJA' },
    role: { en: 'ROLE', es: 'ROL' },
    status: { en: 'STATUS', es: 'ESTADO' },
    inPreparation: { en: 'In preparation', es: 'En preparación' },
    machine: { en: 'The machine', es: 'La máquina' },
    plateAlt: {
      en: (title: string, n: string) => `${title}, as it runs on station ${n} of the line`,
      es: (title: string, n: string) => `${title}, tal como funciona en la estación ${n} de la línea`,
    },
    st: { en: 'ST', es: 'EST' },
    running: { en: 'Running on the line — open it there for the exploded view.', es: 'En marcha en la línea: ábrela allí para ver el despiece.' },
    stamp: { en: 'Sheet in preparation', es: 'Hoja en preparación' },
    stampSub: { en: 'Drawings · data · results', es: 'Planos · datos · resultados' },
    note: {
      en: 'The full sheet for this project is being drawn up. Meanwhile, the machine is on the line: switch it on, hold it at full power or take it apart.',
      es: 'La hoja completa de este proyecto se está dibujando. Mientras tanto, la máquina está en la línea: enciéndela, llévala a plena potencia o desmóntala.',
    },
    ask: { en: 'Ask me about it', es: 'Pregúntame por él' },
    askSubject: { en: (title: string) => `About ${title}`, es: (title: string) => `Sobre ${title}` },
    bom: { en: 'Bill of materials', es: 'Lista de materiales' },
    lessons: { en: 'What I learned', es: 'Qué aprendí' },
    keyFigures: { en: 'Key figures', es: 'Cifras clave' },
    howItWorks: { en: 'HOW IT WORKS', es: 'CÓMO FUNCIONA' },
    tests: { en: (n: number) => `${n} tests`, es: (n: number) => `${n} ensayos` },
    screens: { en: 'Product screens', es: 'Pantallas del producto' },
    prevScreen: { en: 'Previous screen', es: 'Pantalla anterior' },
    nextScreen: { en: 'Next screen', es: 'Pantalla siguiente' },
    enlarge: { en: 'Enlarge', es: 'Ampliar' },
    goToScreen: { en: 'Go to screen', es: 'Ir a la pantalla' },
    zoomIn: { en: 'Tap to zoom in', es: 'Toca para acercar' },
    zoomOut: { en: 'Tap to see it whole', es: 'Toca para verla entera' },
    testsInOrder: { en: 'Tests, in order', es: 'Ensayos, en orden' },
    test: { en: 'Test', es: 'Ensayo' },
    onThisPage: { en: 'On this page', es: 'En esta página' },
    legend: {
      rejected: { en: 'Not adopted', es: 'No adoptado' },
      adopted: { en: 'Adopted in sample', es: 'Adoptado en la muestra' },
      reverted: { en: 'Reverted after the holdout', es: 'Revertido tras el holdout' },
    },
    verdict: {
      rejected: { en: 'NOT ADOPTED', es: 'NO ADOPTADO' },
      adopted: { en: 'ADOPTED', es: 'ADOPTADO' },
      failed: { en: 'FAILED', es: 'FALLIDO' },
      reverted: { en: 'REVERTED', es: 'REVERTIDO' },
    },
  },

  cv: {
    email: { en: 'EMAIL', es: 'EMAIL' },
    basedIn: { en: 'BASED IN', es: 'RESIDENCIA' },
    portfolio: { en: 'PORTFOLIO', es: 'PORTAFOLIO' },
    status: { en: 'STATUS', es: 'ESTADO' },
    skills: { en: 'Skills', es: 'Habilidades' },
    languages: { en: 'Languages', es: 'Idiomas' },
    native: { en: 'Native', es: 'Nativo' },
    strengths: { en: 'Strengths', es: 'Puntos fuertes' },
    profile: { en: 'Profile', es: 'Perfil' },
    experience: { en: 'Experience', es: 'Experiencia' },
    education: { en: 'Education', es: 'Formación' },
    certificates: { en: 'Certificates', es: 'Certificados' },
    footTitle: { en: 'CURRICULUM VITAE', es: 'CURRÍCULUM' },
    footSheet: { en: 'SHEET 1 / 1', es: 'HOJA 1 / 1' },
    lineSheet: { en: 'CV · SHEET 1 / 1', es: 'CV · HOJA 1 / 1' },
    of: { en: (person: string) => `CV of ${person}`, es: (person: string) => `CV de ${person}` },
  },

  lost: {
    label: { en: 'Off the line', es: 'Fuera de la línea' },
    kicker: { en: '404 · Not in the drawing set', es: '404 · No está en el juego de planos' },
    title: { en: 'Off the line', es: 'Fuera de la línea' },
    lead: {
      en: 'This sheet doesn’t exist. The line has five machines and a way out at the end: pick one below, or start from the beginning.',
      es: 'Esta hoja no existe. La línea tiene cinco máquinas y una salida al final: elige una abajo o empieza desde el principio.',
    },
    back: { en: 'Back to the line', es: 'Volver a la línea' },
    sheet: { en: '404 · OFF THE LINE', es: '404 · FUERA DE LA LÍNEA' },
  },

  error: {
    kicker: { en: 'Error · The line stopped', es: 'Error · La línea se ha parado' },
    title: { en: 'Line stopped', es: 'Línea parada' },
    lead: {
      en: (email: string) => `Something jammed while drawing this sheet. Try again — and if it keeps stopping, you can still write to ${email} or read the CV.`,
      es: (email: string) => `Algo se ha atascado al dibujar esta hoja. Vuelve a intentarlo; si se sigue parando, puedes escribirme a ${email} o leer el CV.`,
    },
    retry: { en: 'Try again', es: 'Reintentar' },
  },
};

const UI_IN = bilingual(UI_SRC);
export type Ui = (typeof UI_IN)['en'];

/** Los textos de la interfaz en un idioma. */
export const uiIn = (lang: Lang): Ui => UI_IN[lang];

/** Lo mismo en un componente de cliente, con el idioma de la página. */
export const useUi = () => UI_IN[useLang()];
