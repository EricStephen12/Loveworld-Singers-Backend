"use client";

export class DeviceSafeArea {
  private static instance: DeviceSafeArea;
  private deviceType: 'iphone' | 'android' | 'other' = 'other';
  private hasNotch: boolean = false;
  private hasHomeIndicator: boolean = false;

  private constructor() {
    this.detectDevice();
    this.setupSafeAreaCSS();
  }

  public static getInstance(): DeviceSafeArea {
    if (!DeviceSafeArea.instance) {
      DeviceSafeArea.instance = new DeviceSafeArea();
    }
    return DeviceSafeArea.instance;
  }

  private detectDevice(): void {
    const userAgent = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(userAgent);
    const isAndroid = /android/.test(userAgent);

    if (isIOS) {
      this.deviceType = 'iphone';
      this.hasNotch = this.detectNotch();
      this.hasHomeIndicator = this.detectHomeIndicator();
    } else if (isAndroid) {
      this.deviceType = 'android';
    }

  }

  private detectNotch(): boolean {
    // Check for iPhone X and newer (with notch)
    const isIPhoneX = /iphone/.test(navigator.userAgent.toLowerCase()) &&
      (window.screen.height >= 812 || window.screen.width >= 812);
    return isIPhoneX;
  }

  private detectHomeIndicator(): boolean {
    // Check for devices with home indicator (iPhone X and newer)
    return this.hasNotch ||
      (window.screen.height >= 812 || window.screen.width >= 812);
  }

  private setupSafeAreaCSS(): void {
    if (typeof window === 'undefined') return;

    const root = document.documentElement;

    // Set device-specific CSS variables
    root.style.setProperty('--device-type', this.deviceType);
    root.style.setProperty('--has-notch', this.hasNotch ? '1' : '0');
    root.style.setProperty('--has-home-indicator', this.hasHomeIndicator ? '1' : '0');

    // Add device-specific classes
    document.body.classList.add(`device-${this.deviceType}`);
    if (this.hasNotch) document.body.classList.add('has-notch');
    if (this.hasHomeIndicator) document.body.classList.add('has-home-indicator');

        this.updateSafeAreaValues();
  }

  private updateSafeAreaValues(): void {
    const root = document.documentElement;

    if (this.deviceType === 'iphone') {
      if (this.hasHomeIndicator) {
        // iPhone X and newer with home indicator
        root.style.setProperty('--enhanced-safe-area-bottom', '34px');
        root.style.setProperty('--input-safe-area-bottom', '20px');
        root.style.setProperty('--nav-safe-area-bottom', '24px');
      } else {
        // Older iPhones
        root.style.setProperty('--enhanced-safe-area-bottom', '20px');
        root.style.setProperty('--input-safe-area-bottom', '16px');
        root.style.setProperty('--nav-safe-area-bottom', '20px');
      }
    } else if (this.deviceType === 'android') {
      // Android devices with navigation bar
      root.style.setProperty('--enhanced-safe-area-bottom', '24px');
      root.style.setProperty('--input-safe-area-bottom', '20px');
      root.style.setProperty('--nav-safe-area-bottom', '24px');
    } else {
      // Other devices
      root.style.setProperty('--enhanced-safe-area-bottom', '20px');
      root.style.setProperty('--input-safe-area-bottom', '16px');
      root.style.setProperty('--nav-safe-area-bottom', '20px');
    }
  }

  public getDeviceInfo() {
    return {
      type: this.deviceType,
      hasNotch: this.hasNotch,
      hasHomeIndicator: this.hasHomeIndicator
    };
  }

  public getSafeAreaBottom(type: 'input' | 'nav' | 'default' = 'default'): string {
    const envValue = 'env(safe-area-inset-bottom, 0px)';

    switch (type) {
      case 'input':
        return `max(${envValue}, var(--input-safe-area-bottom, 16px))`;
      case 'nav':
        return `max(${envValue}, var(--nav-safe-area-bottom, 20px))`;
      default:
        return `max(${envValue}, var(--enhanced-safe-area-bottom, 20px))`;
    }
  }

  public init(): void {
    // Re-run detection on orientation change
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        this.detectDevice();
        this.setupSafeAreaCSS();
      }, 100);
    });

    // Re-run detection on resize
    window.addEventListener('resize', () => {
      this.detectDevice();
      this.setupSafeAreaCSS();
    });
  }
}

// Initialized via AppBootstrap component
