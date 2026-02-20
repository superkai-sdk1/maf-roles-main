<?php
/**
 * Прокси для загрузки списка турниров с gomafia.pro
 * Принимает фильтры и возвращает чистый JSON
 */
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

if (!isset($_REQUEST['za'])) {
    http_response_code(403);
    echo json_encode(['error' => 'Forbidden']);
    exit();
}

ini_set('error_reporting', E_ALL);
ini_set('display_errors', 0);

// Параметры фильтрации
$period = isset($_REQUEST['period']) ? $_REQUEST['period'] : '';
$type = isset($_REQUEST['type']) ? $_REQUEST['type'] : '';
$fsm = isset($_REQUEST['fsm']) ? $_REQUEST['fsm'] : '';
$search = isset($_REQUEST['search']) ? $_REQUEST['search'] : '';
$page = isset($_REQUEST['page']) ? intval($_REQUEST['page']) : 1;

// Формируем URL gomafia.pro/tournaments
$url = 'https://gomafia.pro/tournaments';
$params = [];
if ($period) $params['period'] = $period;
if ($type) $params['type'] = $type;
if ($fsm) $params['fsm'] = $fsm;
if ($search) $params['search'] = $search;
if ($page > 1) $params['page'] = $page;

if (!empty($params)) {
    $url .= '?' . http_build_query($params);
}

// Загружаем HTML-страницу
$context = stream_context_create([
    'http' => [
        'timeout' => 15,
        'header' => "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36\r\n" .
                     "Accept: text/html,application/xhtml+xml\r\n" .
                     "Accept-Language: ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7\r\n"
    ]
]);

$html = @file_get_contents($url, false, $context);

if ($html === false) {
    http_response_code(502);
    echo json_encode(['error' => 'Failed to fetch gomafia.pro', 'url' => $url]);
    exit();
}

// Извлекаем __NEXT_DATA__ из HTML
if (preg_match('/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s', $html, $match)) {
    $nextData = json_decode($match[1], true);

    if ($nextData && isset($nextData['props']['pageProps'])) {
        $pageProps = $nextData['props']['pageProps'];
        $buildId = isset($nextData['buildId']) ? $nextData['buildId'] : '';

        // ─── Извлекаем ELO из HTML для каждого турнира ───
        // Ищем блоки турниров: ссылка /tournament/ID ... Icon_icon_elo ... число
        // Паттерн: каждая строка таблицы содержит ссылку на турнир и (может быть) ELO
        $eloMap = [];

        // Находим все турнирные строки (tr или div) с ссылкой и ELO
        // Стратегия: ищем все /tournament/ЧИСЛО и все Icon_icon_elo + число в порядке появления
        preg_match_all('/href="\/tournament\/(\d+)"/', $html, $tournamentLinks);
        $tournamentIds = isset($tournamentLinks[1]) ? $tournamentLinks[1] : [];

        // Ищем все ELO значения — паттерн: Icon_icon_elo...></span> затем число
        // Пример HTML: <span class="...Icon_icon_elo__NdEMd" style="..."></span>1165
        // или: <span class="...Icon_icon_elo__NdEMd" style="..."></span>\n        2003
        preg_match_all('/Icon_icon_elo[^"]*"[^>]*><\/span>\s*(\d+)/', $html, $eloMatches);
        $eloValues = isset($eloMatches[1]) ? $eloMatches[1] : [];

        // Альтернативный паттерн — ELO число может быть внутри вложенного div
        if (empty($eloValues)) {
            preg_match_all('/icon_elo[^"]*"[^>]*><\/span>\s*(\d+)/i', $html, $eloMatches2);
            $eloValues = isset($eloMatches2[1]) ? $eloMatches2[1] : [];
        }

        // Более точный подход: для каждого турнирного блока проверяем наличие ELO
        // Разбиваем HTML по ссылкам на турниры
        $chunks = preg_split('/href="\/tournament\/(\d+)"/', $html, -1, PREG_SPLIT_DELIM_CAPTURE);
        for ($i = 1; $i < count($chunks); $i += 2) {
            $tid = $chunks[$i];
            $nextChunk = isset($chunks[$i + 1]) ? $chunks[$i + 1] : '';
            // Берём текст до следующей ссылки на турнир (ограничиваем ~3000 символов)
            $section = substr($nextChunk, 0, 3000);

            // Ищем ELO ТОЛЬКО если есть класс icon_elo (конкретный индикатор ELO)
            // НЕ используем tournament-table__stars — он есть на ВСЕХ турнирах
            if (preg_match('/icon_elo/i', $section)) {
                $eloNum = 0;
                // Паттерн 1: Icon_icon_elo..."></span> число (3-4 цифры)
                if (preg_match('/icon_elo[^"]*"[^>]*><\/span>\s*(\d{3,4})/i', $section, $eloVal)) {
                    $eloNum = intval($eloVal[1]);
                }
                // Паттерн 2: icon_elo ... </span> ... число (с переносами строк)
                elseif (preg_match('/icon_elo.*?<\/span>\s*(\d{3,4})/s', $section, $eloVal2)) {
                    $eloNum = intval($eloVal2[1]);
                }

                // Рассадка доступна только если ELO — число от 100 до 9999
                if ($eloNum >= 100) {
                    $eloMap[$tid] = $eloNum;
                }
            }
        }

        // ─── Помечаем турниры с рассадкой ───
        // Ищем массив турниров в pageProps
        $serverData = isset($pageProps['serverData']) ? $pageProps['serverData'] : $pageProps;

        // Функция для пометки турниров в массиве
        function markSeating(&$arr, $eloMap) {
            if (!is_array($arr)) return;
            foreach ($arr as &$t) {
                if (!is_array($t)) continue;
                $tid = isset($t['id']) ? strval($t['id']) : (isset($t['tournamentId']) ? strval($t['tournamentId']) : '');
                if ($tid && isset($eloMap[$tid])) {
                    $t['_hasSeating'] = true;
                    $t['_elo'] = $eloMap[$tid];
                }
            }
            unset($t);
        }

        // Применяем ко всем возможным массивам турниров
        if (is_array($serverData)) {
            if (isset($serverData['tournaments'])) {
                markSeating($serverData['tournaments'], $eloMap);
            }
            if (isset($serverData['items'])) {
                markSeating($serverData['items'], $eloMap);
            }
            // Проверяем все массивы верхнего уровня
            foreach ($serverData as $key => &$val) {
                if (is_array($val) && !empty($val) && is_array(reset($val))) {
                    $first = reset($val);
                    if (isset($first['id']) || isset($first['tournamentId']) || isset($first['name'])) {
                        markSeating($val, $eloMap);
                    }
                }
            }
            unset($val);

            // Обновляем pageProps
            if (isset($pageProps['serverData'])) {
                $pageProps['serverData'] = $serverData;
            } else {
                $pageProps = $serverData;
            }
        }

        echo json_encode([
            'success' => true,
            'buildId' => $buildId,
            'data' => $pageProps,
            'url' => $url,
            '_eloTournaments' => array_keys($eloMap),
            '_eloCount' => count($eloMap),
            '_totalTournamentLinks' => count($tournamentIds),
            '_debug_eloValues' => array_slice($eloValues, 0, 5),
            '_debug_chunks' => count($chunks)
        ], JSON_UNESCAPED_UNICODE);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to parse __NEXT_DATA__', 'url' => $url]);
    }
} else {
    // Попробуем альтернативный подход - _next/data API
    // Сначала извлечём buildId из HTML
    $buildId = '';
    if (preg_match('/"buildId"\s*:\s*"([^"]+)"/', $html, $buildMatch)) {
        $buildId = $buildMatch[1];
    }

    if ($buildId) {
        // Попробуем загрузить через Next.js data API
        $apiUrl = "https://gomafia.pro/_next/data/{$buildId}/tournaments.json";
        if (!empty($params)) {
            $apiUrl .= '?' . http_build_query($params);
        }

        $apiHtml = @file_get_contents($apiUrl, false, $context);
        if ($apiHtml !== false) {
            $apiData = json_decode($apiHtml, true);
            if ($apiData && isset($apiData['pageProps'])) {
                echo json_encode([
                    'success' => true,
                    'buildId' => $buildId,
                    'data' => $apiData['pageProps'],
                    'url' => $apiUrl
                ], JSON_UNESCAPED_UNICODE);
                exit();
            }
        }
    }

    http_response_code(500);
    echo json_encode([
        'error' => 'No __NEXT_DATA__ found in response',
        'url' => $url,
        'htmlLength' => strlen($html),
        'htmlPreview' => substr($html, 0, 500)
    ]);
}

