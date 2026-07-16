export type LocalizedBriefingText = {
  ru: string;
  en: string;
};

export type MinigameBriefing = {
  title: LocalizedBriefingText;
  objective: LocalizedBriefingText;
  rules: LocalizedBriefingText[];
};

export const MINIGAME_BRIEFINGS: Record<string, MinigameBriefing> = {
  "0": {
    title: { ru: "Повтор последовательности", en: "Sequence relay" },
    objective: {
      ru: "Запомните показанный порядок сигналов и повторите его без спешки.",
      en: "Memorize the displayed signal order and repeat it carefully.",
    },
    rules: [
      { ru: "Сначала только наблюдайте за подсвеченными секторами.", en: "First, only watch the highlighted sectors." },
      { ru: "Затем нажмите их в том же порядке.", en: "Then tap them in the same order." },
      { ru: "Ошибка создаёт новый шаблон текущего раунда.", en: "A mistake creates a new pattern for the current round." },
    ],
  },
  "1": {
    title: { ru: "Перехват сигнала", en: "Signal interception" },
    objective: {
      ru: "Найдите на пеленгаторе и удержите три сигнальных импульса на этой физической точке.",
      en: "Locate and hold three signal bursts on the radar at this physical station.",
    },
    rules: [
      { ru: "Цель появляется короткими импульсами; ищите её частоту и фазу по общей силе сигнала.", en: "The target appears in short bursts; use overall signal strength to find its frequency and phase." },
      { ru: "Каждая из трёх меток имеет собственный режим дрейфа и помех.", en: "Each of the three tags has its own drift and interference mode." },
      { ru: "Задание завершится только после трёх разных точек.", en: "The task completes only after all three distinct stations." },
    ],
  },
  "2": {
    title: { ru: "Взлом пароля", en: "Password crack" },
    objective: {
      ru: "Определите пятизначный код. Цифры могут повторяться.",
      en: "Determine the five-digit code. Digits may repeat.",
    },
    rules: [
      { ru: "Зелёная отметка: цифра и позиция верны.", en: "Green: both digit and position are correct." },
      { ru: "Жёлтая отметка: цифра есть, но стоит в другом месте.", en: "Yellow: the digit exists but belongs elsewhere." },
      { ru: "История попыток остаётся на экране.", en: "Your previous attempts remain visible." },
    ],
  },
  "3": {
    title: { ru: "Хеш-реактор", en: "Hash reactor" },
    objective: {
      ru: "Стабилизируйте три модуля, фиксируя индикатор внутри зелёной зоны.",
      en: "Stabilize three modules by locking the cursor inside the green zone.",
    },
    rules: [
      { ru: "У каждого модуля свой режим скорости и движения.", en: "Every module uses a different speed and movement mode." },
      { ru: "Промах повышает перегрев и отнимает хеш текущего модуля.", en: "A miss adds heat and removes one hash from the current module." },
      { ru: "Перегрев перезапускает только текущий модуль.", en: "Maximum heat resets only the current module." },
    ],
  },
  "4": {
    title: { ru: "Уничтожение вирусов", en: "Virus cleanup" },
    objective: {
      ru: "Удаляйте вирусы правильным инструментом и не повреждайте обычные файлы.",
      en: "Remove viruses with the correct tool and avoid damaging normal files." },
    rules: [
      { ru: "Карантин подходит для обычных, быстрых и скрытых вирусов.", en: "Quarantine handles normal, fast, and stealth viruses." },
      { ru: "Пробой брони применяется только к бронированным вирусам.", en: "Armor breaker is only for armored viruses." },
      { ru: "Обычные файлы тоже могут вспыхивать; проверяйте значок и подпись. Ошибка: −1 очко.", en: "Normal files may also flash; check the icon and label. A mistake costs 1 point." },
    ],
  },
  "5": {
    title: { ru: "Сумма до ста", en: "Sum to one hundred" },
    objective: {
      ru: "Выбирайте указанное количество чисел с общей суммой ровно 100.",
      en: "Select the required number of values whose total is exactly 100." },
    rules: [
      { ru: "Сначала будут две пары, затем три комбинации из трёх чисел.", en: "You will solve two pairs followed by three three-number combinations." },
      { ru: "Текущая сумма отображается над полем.", en: "Your current total is shown above the board." },
      { ru: "Неверная полная комбинация сбрасывает только текущий выбор.", en: "A wrong full combination resets only the current selection." },
    ],
  },
  "6": {
    title: { ru: "Уничтожение улик", en: "Evidence disposal" },
    objective: { ru: "Запомните контрольную сигнатуру и удаляйте только совпадающие улики.", en: "Memorize the target signature and destroy only matching evidence." },
    rules: [
      { ru: "Сигнатура показывается перед серией документов.", en: "The signature appears before each document sequence." },
      { ru: "Сравнивайте форму, код и маркировку.", en: "Compare the shape, code, and marking." },
      { ru: "Неверный выбор сокращает оставшееся время.", en: "A wrong choice reduces the remaining time." },
    ],
  },
  "7": {
    title: { ru: "Маршрутизация пакетов", en: "Packet routing" },
    objective: { ru: "Соберите непрерывный маршрут от источника до приёмника.", en: "Build a continuous route from source to destination." },
    rules: [
      { ru: "Нажатие поворачивает выбранный узел.", en: "Tap a node to rotate it." },
      { ru: "Все соединения пути должны совпасть.", en: "Every connection along the route must match." },
      { ru: "Лишние ответвления не должны вести за край поля.", en: "Unused branches must not lead outside the board." },
    ],
  },
  "8": {
    title: { ru: "Журнал доступа", en: "Access log" },
    objective: { ru: "Разрешайте безопасные события и блокируйте нарушения текущего правила.", en: "Allow safe events and block entries that violate the current rule." },
    rules: [
      { ru: "Перед каждым событием читайте активное правило.", en: "Read the active rule before every event." },
      { ru: "Выберите только «Разрешить» или «Блокировать».", en: "Choose either Allow or Block." },
      { ru: "Серия верных решений увеличивает прогресс.", en: "A streak of correct decisions advances progress." },
    ],
  },
  "9": {
    title: { ru: "Энергосеть", en: "Power grid" },
    objective: { ru: "Трижды сбалансируйте четыре сектора и удержите стабильность.", en: "Balance four sectors across three stages and hold the grid stable." },
    rules: [
      { ru: "Каждый сектор должен получить не меньше своего запроса.", en: "Every sector must receive at least its demand." },
      { ru: "Сильный избыток и общий расход выше 100 считаются перегрузкой.", en: "Large excess and a total above 100 count as overload." },
      { ru: "После устойчивого этапа запросы секторов изменятся.", en: "Sector demands change after each stable stage." },
    ],
  },
  secret: {
    title: { ru: "Переопределение системы", en: "System override" },
    objective: { ru: "Введите код доступа и завершите длинную последовательность команд.", en: "Enter the access code and complete the extended command sequence." },
    rules: [
      { ru: "Выполняйте этапы строго по порядку.", en: "Complete every stage in order." },
      { ru: "Неверная команда сбрасывает текущую последовательность.", en: "A wrong command resets the current sequence." },
      { ru: "Это дополнительное задание и не влияет на общий прогресс.", en: "This is an optional task and does not affect shared progress." },
    ],
  },
};
