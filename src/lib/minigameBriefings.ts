export type LocalizedBriefingText = {
  ru: string;
  en: string;
};

export type MinigameBriefing = {
  title: LocalizedBriefingText;
  objective: LocalizedBriefingText;
  rules: LocalizedBriefingText[];
  controls?: LocalizedBriefingText;
  success?: LocalizedBriefingText;
  warning?: LocalizedBriefingText;
};

export const MINIGAME_BRIEFINGS: Record<string, MinigameBriefing> = {
  "0": {
    title: { ru: "Повтор последовательности", en: "Sequence relay" },
    objective: {
      ru: "Запомните показанный порядок сигналов и повторите его без спешки.",
      en: "Memorize the displayed signal order and repeat it carefully.",
    },
    controls: { ru: "Смотрите на сектора, затем нажимайте их по одному.", en: "Watch the sectors, then tap them one by one." },
    success: { ru: "Завершите все раунды, не меняя порядок вспышек.", en: "Complete every round without changing the flash order." },
    warning: { ru: "Во время показа кнопки заблокированы. Нажимать можно только после сигнала.", en: "Buttons are locked during playback. Tap only after the prompt." },
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
    controls: { ru: "Настройте частоту и фазу ползунками, затем включите захват сигнала.", en: "Tune frequency and phase with the sliders, then arm signal capture." },
    success: { ru: "Держите качество в зелёной зоне 7 секунд для каждого из трёх импульсов.", en: "Keep quality in the green zone for 7 seconds on each of three bursts." },
    warning: { ru: "Цель дрейфует, а помехи прерывают фиксацию — продолжайте корректировать ползунки.", en: "The target drifts and jamming interrupts the lock, so keep adjusting the sliders." },
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
    controls: { ru: "Введите пять цифр и подтвердите попытку.", en: "Enter five digits and submit the attempt." },
    success: { ru: "Получите пять зелёных отметок в одной строке.", en: "Get five green marks in a single row." },
    warning: { ru: "Жёлтая цифра верна, но находится в другой позиции.", en: "A yellow digit is correct but belongs in another position." },
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
    controls: { ru: "Нажмите фиксацию, когда движущийся маркер находится внутри зелёной зоны.", en: "Press lock while the moving marker is inside the green zone." },
    success: { ru: "Наберите нужное число точных фиксаций на каждом модуле.", en: "Reach the required number of precise locks on every module." },
    warning: { ru: "Промах повышает нагрев; максимальный нагрев перезапускает текущий модуль.", en: "A miss adds heat; maximum heat restarts the current module." },
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
    controls: { ru: "Сначала выберите инструмент, затем нажмите заражённый узел.", en: "Select a tool first, then tap the infected node." },
    success: { ru: "Изолируйте 22 угрозы. Первые четыре появляются по одной и дают время освоиться.", en: "Isolate 22 threats. The first four appear one at a time so you can learn." },
    warning: { ru: "Синий узел со щитом ◆ — броня: только «Пробой брони». Все остальные угрозы — «Карантин».", en: "A blue node with a ◆ shield is armored: use Armor breaker. Use Quarantine for every other threat." },
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
    controls: { ru: "Нажимайте карточки чисел; повторное нажатие снимает выбор.", en: "Tap number cards; tap again to deselect." },
    success: { ru: "Соберите две пары и три тройки с суммой ровно 100.", en: "Build two pairs and three triples totaling exactly 100." },
    warning: { ru: "Количество выбранных карточек ограничено условием текущего раунда.", en: "The current round limits how many cards can be selected." },
    rules: [
      { ru: "Сначала будут две пары, затем три комбинации из трёх чисел.", en: "You will solve two pairs followed by three three-number combinations." },
      { ru: "Текущая сумма отображается над полем.", en: "Your current total is shown above the board." },
      { ru: "Неверная полная комбинация сбрасывает только текущий выбор.", en: "A wrong full combination resets only the current selection." },
    ],
  },
  "6": {
    title: { ru: "Уничтожение улик", en: "Evidence disposal" },
    objective: { ru: "Запомните контрольную сигнатуру и удаляйте только совпадающие улики.", en: "Memorize the target signature and destroy only matching evidence." },
    controls: { ru: "Сравните документ с образцом и выберите удалить или пропустить.", en: "Compare each document with the sample and choose destroy or skip." },
    success: { ru: "Правильно обработайте всю последовательность документов.", en: "Classify the entire document sequence correctly." },
    warning: { ru: "Проверяйте одновременно форму, код и маркировку — одного совпадения недостаточно.", en: "Check shape, code, and marking together; one match is not enough." },
    rules: [
      { ru: "Сигнатура показывается перед серией документов.", en: "The signature appears before each document sequence." },
      { ru: "Сравнивайте форму, код и маркировку.", en: "Compare the shape, code, and marking." },
      { ru: "Неверный выбор сокращает оставшееся время.", en: "A wrong choice reduces the remaining time." },
    ],
  },
  "7": {
    title: { ru: "Маршрутизация пакетов", en: "Packet routing" },
    objective: { ru: "Соберите непрерывный маршрут от источника до приёмника.", en: "Build a continuous route from source to destination." },
    controls: { ru: "Каждое нажатие поворачивает узел на 90 градусов.", en: "Each tap rotates a node by 90 degrees." },
    success: { ru: "Соедините левый вход с правым выходом за 120 секунд.", en: "Connect the left input to the right output within 120 seconds." },
    warning: { ru: "Зелёный цвет показывает только уже подключённую часть, а не готовое решение.", en: "Green shows only the currently powered section, not the solution." },
    rules: [
      { ru: "Нажатие поворачивает выбранный узел.", en: "Tap a node to rotate it." },
      { ru: "Все соединения пути должны совпасть.", en: "Every connection along the route must match." },
      { ru: "Лишние ответвления не должны вести за край поля.", en: "Unused branches must not lead outside the board." },
    ],
  },
  "8": {
    title: { ru: "Журнал доступа", en: "Access log" },
    objective: { ru: "Разрешайте безопасные события и блокируйте нарушения текущего правила.", en: "Allow safe events and block entries that violate the current rule." },
    controls: { ru: "Прочитайте правило и нажмите «Разрешить» либо «Блокировать».", en: "Read the rule and press Allow or Block." },
    success: { ru: "Наберите требуемую серию правильных решений.", en: "Build the required streak of correct decisions." },
    warning: { ru: "Активное правило может измениться — перечитывайте его перед каждым событием.", en: "The active rule can change, so reread it before every event." },
    rules: [
      { ru: "Перед каждым событием читайте активное правило.", en: "Read the active rule before every event." },
      { ru: "Выберите только «Разрешить» или «Блокировать».", en: "Choose either Allow or Block." },
      { ru: "Серия верных решений увеличивает прогресс.", en: "A streak of correct decisions advances progress." },
    ],
  },
  "9": {
    title: { ru: "Энергосеть", en: "Power grid" },
    objective: { ru: "Сбалансируйте четыре сектора на четырёх этапах и удержите стабильность.", en: "Balance four sectors across four stages and hold the grid stable." },
    controls: { ru: "Распределяйте мощность четырьмя ползунками и следите за общей нагрузкой.", en: "Allocate power with four sliders while watching total load." },
    success: { ru: "Пройдите четыре этапа: попадите в диапазон мощности, закройте запросы и выровняйте контуры.", en: "Clear four stages by hitting the load range, meeting demands, and balancing both circuits." },
    warning: { ru: "Избыток сектора выше 4 единиц, неверный общий диапазон или перекос контуров нарушают стабильность.", en: "More than 4 excess units, the wrong total range, or circuit imbalance breaks stability." },
    rules: [
      { ru: "Каждый сектор должен получить не меньше своего запроса.", en: "Every sector must receive at least its demand." },
      { ru: "Сильный избыток и общий расход выше 100 считаются перегрузкой.", en: "Large excess and a total above 100 count as overload." },
      { ru: "После устойчивого этапа запросы секторов изменятся.", en: "Sector demands change after each stable stage." },
    ],
  },
  secret: {
    title: { ru: "Переопределение системы", en: "System override" },
    objective: { ru: "Введите код доступа и завершите длинную последовательность команд.", en: "Enter the access code and complete the extended command sequence." },
    controls: { ru: "Вводите команды на экранной панели строго по порядку.", en: "Enter commands on the panel in the displayed order." },
    success: { ru: "Завершите все этапы протокола переопределения.", en: "Complete every stage of the override protocol." },
    warning: { ru: "Неверная команда сбрасывает только текущую последовательность, но не весь протокол.", en: "A wrong command resets the current sequence, not the entire protocol." },
    rules: [
      { ru: "Выполняйте этапы строго по порядку.", en: "Complete every stage in order." },
      { ru: "Неверная команда сбрасывает текущую последовательность.", en: "A wrong command resets the current sequence." },
      { ru: "Это дополнительное задание и не влияет на общий прогресс.", en: "This is an optional task and does not affect shared progress." },
    ],
  },
};
