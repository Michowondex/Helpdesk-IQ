// Client-side non-intrusive diagnostic sensor
// Captures workstation context to attach to tickets so technicians never ask "what OS / browser are you using?"

export function getSystemDiagnostics() {
  const ua = navigator.userAgent || "";
  
  // OS Detection
  let os = "Unknown OS";
  if (/Windows NT 10.0/i.test(ua)) os = "Windows 10/11";
  else if (/Windows NT 6.3/i.test(ua)) os = "Windows 8.1";
  else if (/Windows NT 6.1/i.test(ua)) os = "Windows 7";
  else if (/Macintosh|Mac OS X/i.test(ua)) os = "macOS";
  else if (/Linux/i.test(ua)) os = "Linux";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";

  // Browser Detection
  let browser = "Unknown Browser";
  if (/Edg\//i.test(ua)) browser = "Microsoft Edge";
  else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) browser = "Google Chrome";
  else if (/Firefox\//i.test(ua)) browser = "Mozilla Firefox";
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = "Apple Safari";
  else if (/Trident|MSIE/i.test(ua)) browser = "Internet Explorer";

  // Device Form Factor
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(ua);
  const device = isMobile ? "Mobile / Tablet" : "Workstation / Laptop";

  // Screen resolution
  const resolution = typeof window !== "undefined" && window.screen 
    ? `${window.screen.width}x${window.screen.height}` 
    : "1920x1080";

  // Network State
  const online = typeof navigator !== "undefined" ? navigator.onLine : true;
  const network = online ? "Online (Connected)" : "Offline (Disconnected)";

  return {
    os,
    browser,
    device,
    resolution,
    network,
    captured_at: new Date().toISOString()
  };
}

