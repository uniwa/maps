<?php
/**
 * Server-side configuration for maps.sch.gr.
 *
 * To override without touching this file, create config.local.php returning
 * an array of the keys you want to change. It is gitignored.
 *
 *   <?php
 *   return ['canonical_host' => null];   // dev: never redirect
 */

$config = [
    /**
     * Requests arriving on any other host are redirected here.
     * Set to null to disable the redirect entirely, which is what a dev or
     * staging instance wants.
     */
    'canonical_host' => 'maps.sch.gr',
];

if (file_exists(__DIR__ . '/config.local.php')) {
    $config = array_merge($config, require __DIR__ . '/config.local.php');
}

return $config;
