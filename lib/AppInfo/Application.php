<?php
/**
 * SPDX-FileCopyrightText: 2026 uttii-com <https://uttii.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
declare(strict_types=1);

namespace OCA\PathCopy\AppInfo;

use OCA\Files\Event\LoadAdditionalScriptsEvent;
use OCA\PathCopy\Listener\LoadAdditionalScriptsListener;
use OCA\PathCopy\Listener\SettingsStyleListener;
use OCP\AppFramework\App;
use OCP\AppFramework\Bootstrap\IBootContext;
use OCP\AppFramework\Bootstrap\IBootstrap;
use OCP\AppFramework\Bootstrap\IRegistrationContext;
use OCP\AppFramework\Http\Events\BeforeTemplateRenderedEvent;

class Application extends App implements IBootstrap {
    public const APP_ID = 'pathcopy';

    public function __construct() {
        parent::__construct(self::APP_ID);
    }

    public function boot(IBootContext $context): void {}

    public function register(IRegistrationContext $context): void {
        $context->registerEventListener(
            LoadAdditionalScriptsEvent::class,
            LoadAdditionalScriptsListener::class
        );
        $context->registerEventListener(
            BeforeTemplateRenderedEvent::class,
            SettingsStyleListener::class
        );
    }
}
