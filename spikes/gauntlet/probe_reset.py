from gauntlet import pick
tab = pick("youtube.com")
tab.cmd("Emulation.clearDeviceMetricsOverride")
tab.cmd("Emulation.setUserAgentOverride", userAgent="")
tab.cmd("Emulation.setTouchEmulationEnabled", enabled=False)
tab.cmd("Emulation.setCPUThrottlingRate", rate=1)
tab.eval("location.href='https://www.youtube.com/'")
print("reset")
