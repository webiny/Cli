<?php

$autoloader = require_once __DIR__ . '/../vendor/autoload.php';
$autoloader->addPsr4('Apps\\Core\\', __DIR__ . '/../Apps/Core');

use Apps\Core\Php\Bootstrap\Bootstrap;
use Webiny\Component\Http\Response;

/**
 * Initialize the bootstrap
 */

error_reporting(E_ALL);
ini_set("display_errors", 1);
Bootstrap::getInstance()->run();