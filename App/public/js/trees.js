// Troubleshooting decision trees.
// Question node: { q, help?, opts: [[label, next], ...] }
// Fix node:      { fix: title, sev: 'ok'|'warn'|'crit', body, steps: [], cmds?: string, model?: key, step?: n }
// `next` may point to another tree: 'tree:<treeKey>:<nodeId>'
// Content is generic field guidance – always follow your unit's SOPs, manuals and security (ISSM/COMSEC) rules.

export const TREES = {
  starlink: {
    title: 'Starshield – dish & service',
    model: 'starlink',
    start: 's0',
    nodes: {
      s0: {
        q: 'What does the Starshield app show for the dish status?',
        help: 'Open the Starshield app on a phone/laptop on the Starshield Wi-Fi from the transit case, or browse to http://192.168.100.1. From behind the C1121 the same address normally works over its WAN (C1121 guide → status page).',
        opts: [
          ['Offline / Disconnected', 's_power'],
          ['Obstructed', 'f_obstr'],
          ['Searching / Booting for more than 15 min', 's_search'],
          ['Online – but nothing behind the Cisco gets internet', 's_bypass'],
          ['Online – but slow or dropping', 'f_slow'],
          ['App can\'t find the dish at all', 's_power'],
        ],
      },
      s_power: {
        q: 'Is the AC power adapter / network combiner powered (LED lit, if it has one)?',
        help: 'The AC power adapter + network combiner in the transit case powers the dish over the Starshield cable and splits the network out to the Wi-Fi router and the C1121.',
        opts: [['No – dark', 'f_power'], ['Yes – it\'s lit', 's_motor']],
      },
      s_motor: {
        q: 'After a power cycle, does the dish move / self-orient (actuated dish) or does the app show "Booting"?',
        help: 'Unplug the AC power adapter / combiner for 60 seconds, then plug it back in. Watch the dish.',
        opts: [['No – nothing happens / stays Disconnected', 'f_cable'], ['Yes – it boots but never comes Online', 's_search']],
      },
      s_search: {
        q: 'Does the dish have a clear view of the sky (no trees, buildings, vehicles, mast above it)?',
        opts: [['Yes – clear sky', 'f_service'], ['No / not sure', 'f_obstr']],
      },
      s_bypass: {
        q: 'Does the Starshield Wi-Fi from the transit case have internet?',
        help: 'The combiner feeds the Wi-Fi router and the C1121 on separate cables, so the Wi-Fi is a good test of the dish and combiner. If Wi-Fi works but the Cisco side does not, the fault is on the combiner → C1121 cable or the C1121 itself.',
        opts: [['Yes – Wi-Fi works, only the Cisco side is down', 's_wanip'], ['No – Wi-Fi has no internet either', 'f_service'], ['The Wi-Fi network is gone', 'tree:ap:a_ssid'], ['Not sure how this kit should be set up', 'f_routermode']],
      },
      s_wanip: {
        q: 'On the C1121, does GigabitEthernet0/0/0 have an IP address?  (show ip interface brief)',
        help: 'The C1121 is fed straight from the combiner, so it gets its address from Starshield itself – usually 100.64.x.x (CGNAT) or a public IP on some Business plans. A 192.168.1.x address means its cable is plugged into the Wi-Fi router instead of the combiner.',
        opts: [['No – "unassigned" or down', 'tree:c1121:wan'], ['Yes – it has an IP', 'tree:c1121:wan']],
      },
      f_power: {
        fix: 'No power to the AC power adapter / combiner', sev: 'crit', model: 'starlink', step: 4,
        steps: [
          'Check the power source: generator/UPS output, outlet, surge protector, power strip switch.',
          'Plug the AC power adapter / combiner into a different known-good outlet.',
          'Check the combiner AC power cord and (if fitted) its power switch.',
          'If still dark with a known-good outlet, the AC power adapter / combiner has failed. Swap with a spare or raise a ticket in the Starshield account portal (have the Kit/Dish serial ready).',
        ],
      },
      f_cable: {
        fix: 'Dish not communicating – cable or connector', sev: 'warn', model: 'starlink', step: 2,
        steps: [
          'Unplug the AC power adapter / combiner.',
          'Disconnect the Starshield cable at both ends. Inspect for water, corrosion, bent/pushed pins, cuts, crush or rodent damage.',
          'Re-seat both ends fully until they click (weather seal flush). Check the combiner-end connector too.',
          'Power ON and wait up to 15 minutes.',
          'Still Disconnected? Swap in a spare Starshield cable. Never splice or cut the Starshield cable.',
          'If the dish still does not boot on a known-good cable and combiner, the dish has failed – open a support ticket for RMA.',
        ],
      },
      f_obstr: {
        fix: 'Obstruction', sev: 'warn', model: 'starlink', step: 1,
        steps: [
          'Run "Check for Obstructions" in the Starshield app and scan the sky where the dish will be mounted.',
          'Move or raise the dish so it has the widest clear view of the sky (not under masts, antennas, trees, or the VSAT/BGAN beam path).',
          'Keep other satellite antennas out of the Starshield field of view and away from their beam path.',
          'Clear snow/ice/debris from the dish face (do not use tools or pressure-washers).',
          'After moving, reset the obstruction map in the app so it re-learns.',
        ],
      },
      f_service: {
        fix: 'Clear sky but no service – account / outage / reboot', sev: 'warn', model: 'starlink', step: 0,
        steps: [
          'Check the Starshield status page / account portal for an outage in your area.',
          'Confirm the service line is active and the kit is assigned to the right service address/plan (Business, Mobility/Roam as appropriate). Exhausted priority data may reduce speed but should not stop service.',
          'Reboot: app → Settings → Reboot Starshield, or unplug the AC power adapter / combiner for 60 s.',
          'If the dish was moved a long distance, it may take extra time to get a new location fix – leave it 30 min.',
          'Stow and un-stow the dish (actuated dishes) in the app, then reboot.',
          'Persisting? Open a support ticket with the app "Debug data" attached.',
        ],
      },
      f_routermode: {
        fix: 'How this kit is meant to be set up', sev: 'ok', model: 'starlink', step: 4,
        body: 'Dish → Starshield power cable → Starshield Wi-Fi router (router mode, in the transit case) → C1121-8P → secure C9200CX-12P-2X2G.',
        steps: [
          'The AC power adapter + network combiner powers the dish and has two network outputs: one cable to the Starshield Wi-Fi router, and a separate cable to the C1121 Gi0/0/0 WAN.',
          'The C1121 is NOT behind the Wi-Fi router. It gets its own address straight from Starshield (usually 100.64.x.x).',
          'Keep the Starshield Wi-Fi router in router mode (Bypass OFF) so its Wi-Fi stays on. Its mode does not affect the C1121.',
          'Starshield Wi-Fi users are on the Starshield side only. Secure traffic goes over the wired combiner → C1121 → C9200CX path.',
          'If the C1121 shows a 192.168.1.x address, its cable has been moved to the Wi-Fi router – put it back on the combiner output.',
          'If the Wi-Fi disappears, someone may have switched the Wi-Fi router to Bypass mode. Undoing it needs a factory reset of that router (Wi-Fi guide → Bypass is on).',
        ],
      },
      f_slow: {
        fix: 'Online but slow / dropping', sev: 'ok', model: 'starlink', step: 1,
        steps: [
          'Know the ceiling: the dish does 300–475 Mbps down / 50–75 Mbps up, but encrypted (SIPR) traffic is capped at about 100 Mbps by the TACLANE. Around 100 Mbps through the TACLANE is normal, not a fault.',
          'Up to 12 users are supported – more users means less each. Starshield\'s added cryptography also reduces speed compared with plain Starlink.',
          'Check app → Statistics: obstruction %, outages, latency and throughput. Fix any obstruction first.',
          'Heavy rain/snow and peak evening hours reduce throughput – compare against the Statistics history.',
          'Check the Business plan data: when priority data is used up, traffic is deprioritised.',
          'Compare a speed test on the Starshield Wi-Fi with one behind the C1121. Both slow = Starshield/dish. Only the Cisco side slow = C1121, cabling or the secure LAN.',
          'If running VPN/encryption over Starshield, lower TCP MSS on the C1121 LAN/tunnel (e.g. "ip tcp adjust-mss 1360") to stop fragmentation stalls.',
          'Firmware updates usually install overnight and cause a short outage – this is normal.',
        ],
      },
    },
  },

  c1121: {
    title: 'Cisco C1121-8P router (gateway)',
    model: 'c1121',
    start: 'c0',
    nodes: {
      c0: { q: 'Are any LEDs lit on the C1121-8P?', opts: [['No – completely dark', 'f_pwr'], ['Yes', 'c1']] },
      c1: { q: 'Can you log in to the router (SSH / web UI / console)?', opts: [['Yes', 'c2'], ['No – locked out or no IP access', 'f_console']] },
      c2: {
        q: 'What is the problem?',
        opts: [
          ['No internet / WAN down', 'wan'],
          ['LAN devices not getting an IP (DHCP)', 'f_dhcp'],
          ['PoE device not powering on', 'poe'],
          ['Uplink to C9200CX switch is down', 'tree:c9200cx:uplink'],
          ['Can\'t see the Starshield status page (192.168.100.1)', 'f_dishroute'],
        ],
      },
      wan: {
        q: 'Run "show ip interface brief". What is the state of GigabitEthernet0/0/0?',
        opts: [
          ['down / down (no link)', 'f_wan_l1'],
          ['up / up but IP "unassigned"', 'f_wan_dhcp'],
          ['Has an IP but router can\'t ping 8.8.8.8', 'f_wan_route'],
          ['Router can ping 8.8.8.8 but LAN users can\'t browse', 'f_nat'],
        ],
      },
      poe: {
        q: 'Run "show power inline". What does the port show?',
        opts: [['off / faulty / power-deny', 'f_poe'], ['on – drawing power but device still dead', 'f_pd'], ['Port isn\'t listed / no PoE at all', 'f_poe']],
      },
      f_pwr: {
        fix: 'Router has no power', sev: 'crit', model: 'c1121', step: 1,
        steps: ['Check the external power adapter LED and the mains/generator feed.', 'Re-seat the DC barrel plug at the rear of the router.', 'Swap the adapter with a known-good one of the SAME wattage (PoE models need the higher-wattage PoE adapter).', 'Still dark: RMA the router; load the backup config on the spare.'],
      },
      f_console: {
        fix: 'Console access & password recovery', sev: 'warn', model: 'c1121', step: 4,
        steps: [
          'Connect the console cable (RJ45 rollover or USB). Terminal: 9600 baud, 8 data bits, no parity, 1 stop bit, no flow control.',
          'If you still know the password, log in and fix the config.',
          'Password recovery (only if authorised by your network owner): power-cycle and send a Break within 60 s to enter ROMMON.',
          'Follow the commands below, then reset the passwords and save. Note: some secure configs disable password recovery – if so you must restore from backup.',
        ],
        cmds: `rommon 1 > confreg 0x2142
rommon 2 > reset
! (router boots ignoring startup-config)
Router> enable
Router# copy startup-config running-config
Router# configure terminal
Router(config)# enable secret <NEW-SECRET>
Router(config)# username admin privilege 15 secret <NEW-PASS>
Router(config)# config-register 0x2102
Router(config)# end
Router# write memory`,
      },
      f_wan_l1: {
        fix: 'WAN has no link', sev: 'warn', model: 'c1121', step: 2,
        steps: [
          'Re-seat the patch cable at the C1121 Gi0/0/0 and at the combiner output it plugs into (not the Wi-Fi router).',
          'Swap the patch cable with a known-good one (or test it – see Cabling guide).',
          'Check the combiner itself is powered – if the Starshield Wi-Fi also has no internet, go to the Starshield guide.',
          'Gi0/0/0 is often an RJ45/SFP combo – force copper if an SFP is not used.',
          'Make sure the interface is not administratively down.',
        ],
        cmds: `show interfaces GigabitEthernet0/0/0
configure terminal
 interface GigabitEthernet0/0/0
  media-type rj45
  no shutdown
end`,
      },
      f_wan_dhcp: {
        fix: 'WAN link up but no IP from Starshield', sev: 'warn', model: 'c1121', step: 2,
        steps: [
          'The WAN must be a DHCP client and marked as NAT outside.',
          'Release/renew the lease.',
          'Expect a 100.64.x.x (or public) address straight from Starshield. A 192.168.1.x address means the cable is in the Wi-Fi router instead of the combiner. If you swapped the C1121, unplug the combiner for 60 s so Starshield hands a lease to the new MAC.',
          'If still unassigned, confirm the Starshield app shows Online – otherwise go back to the Starshield guide.',
        ],
        cmds: `configure terminal
 interface GigabitEthernet0/0/0
  ip address dhcp
  ip nat outside
  no shutdown
end
release dhcp GigabitEthernet0/0/0
renew dhcp GigabitEthernet0/0/0
show dhcp lease
show ip interface brief`,
      },
      f_wan_route: {
        fix: 'WAN has an IP but no reachability', sev: 'warn', model: 'c1121', step: 2,
        steps: [
          'Check there is a default route learned from DHCP (or add one).',
          'Ping from the WAN interface to isolate routing vs. NAT.',
          'Check DNS is configured if names don\'t resolve.',
          'Check any inbound/outbound ACL or zone-based firewall on Gi0/0/0 is not blocking ICMP/return traffic.',
        ],
        cmds: `show ip route 0.0.0.0
ping 8.8.8.8 source GigabitEthernet0/0/0
show access-lists
show ip interface GigabitEthernet0/0/0 | include access list
configure terminal
 ip route 0.0.0.0 0.0.0.0 dhcp
 ip name-server 1.1.1.1 8.8.8.8
 ip domain lookup
end`,
      },
      f_nat: {
        fix: 'LAN can\'t browse – NAT', sev: 'warn', model: 'c1121', step: 3,
        steps: [
          'LAN SVI/VLAN interface(s) must be "ip nat inside", WAN must be "ip nat outside".',
          'The NAT ACL must include your LAN subnets.',
          'Check translations appear when a client browses.',
          'Adjust the example subnets/VLANs to match your design.',
        ],
        cmds: `configure terminal
 ip access-list standard NAT-INSIDE
  permit 10.10.0.0 0.0.255.255
 ip nat inside source list NAT-INSIDE interface GigabitEthernet0/0/0 overload
 interface Vlan10
  ip nat inside
 interface GigabitEthernet0/0/0
  ip nat outside
end
show ip nat translations
show ip nat statistics`,
      },
      f_dhcp: {
        fix: 'LAN clients not getting DHCP', sev: 'warn', model: 'c1121', step: 3,
        steps: [
          'Check the DHCP pool, bindings, and conflicts on the router.',
          'Confirm the client\'s switch port is in the right VLAN (on the C1121 LAN port or on the C9200CX).',
          'If the client is behind the C9200CX and DHCP snooping is on, the uplink port toward the C1121 must be trusted (C9200CX guide → VLAN/DHCP).',
          'Pool exhausted? Shorten the lease or enlarge the pool.',
        ],
        cmds: `show ip dhcp pool
show ip dhcp binding
show ip dhcp conflict
clear ip dhcp conflict *
show interfaces GigabitEthernet0/1/0 switchport`,
      },
      f_poe: {
        fix: 'PoE not powering the device', sev: 'warn', model: 'c1121', step: 3,
        steps: [
          'Make sure the PoE-rated power adapter is fitted – a lower-wattage adapter powers the router but not PoE.',
          'Check per-port and total PoE budget.',
          'Bounce the port and confirm PoE is set to auto.',
          'Try another LAN port and a known-good cable (bad pairs cause PoE faults).',
          'High-power devices may need more than the per-port limit – use the C9200CX (PoE+) or an injector.',
        ],
        cmds: `show power inline
show power inline GigabitEthernet0/1/0 detail
configure terminal
 interface GigabitEthernet0/1/0
  power inline auto
  shutdown
  no shutdown
end`,
      },
      f_pd: {
        fix: 'Port supplies PoE but the device stays dead', sev: 'ok', model: 'c1121', step: 3,
        steps: ['Check the device needs no more power than the port gives (802.3af 15.4 W, 802.3at 30 W).', 'Swap the patch cable – one bad pair can pass PoE detection but not run the device.', 'Try the device on another PoE port or a known-good injector.', 'Give it a few minutes to boot, then check its own status LED and manual.', 'Still dead on a known-good port and cable: swap the device.'],
      },
      f_dishroute: {
        fix: 'Reach the Starshield status page through the C1121', sev: 'ok', model: 'c1121', step: 2,
        body: 'The C1121 WAN sits on the Starshield side of the combiner, so the dish status address (192.168.100.1) is reached out of Gi0/0/0. Add a host route if it is not reachable, and make sure the LAN is NAT\'d out of the WAN.',
        steps: ['Quickest check: from a device on the Starshield Wi-Fi, open the Starshield app or http://192.168.100.1.', 'From behind the C1121, ping 192.168.100.1. If it fails, add the host route below.', 'Make sure your LAN subnet is in the NAT ACL (it is NAT\'d out of Gi0/0/0).'],
        cmds: `configure terminal
 ip route 192.168.100.1 255.255.255.255 GigabitEthernet0/0/0 dhcp
end
ping 192.168.100.1`,
      },
    },
  },

  ap: {
    title: 'Starshield router Wi-Fi (in transit case)',
    model: 'starlink',
    start: 'a0',
    nodes: {
      a0: {
        q: 'What is wrong with the Starshield Wi-Fi?',
        help: 'The Wi-Fi comes from the Starshield router in the transit case. It is fed by its own cable from the AC power adapter / network combiner, separately from the C1121. Keep it in router mode (Bypass OFF) so its Wi-Fi stays on.',
        opts: [
          ['The Wi-Fi network (SSID) doesn\'t show up at all', 'a_ssid'],
          ['I can see it but can\'t join', 'f_join'],
          ['Connected, but no internet', 'a_inet'],
          ['Weak signal, slow, or keeps dropping', 'f_weak'],
          ['Starshield Wi-Fi router is dark / no lights', 'f_rtr_dark'],
        ],
      },
      a_ssid: {
        q: 'Has the Starshield router been put into Bypass mode?',
        help: 'Check in the Starshield app: Settings → Router. In Bypass mode the router\'s Wi-Fi is switched off completely. If you can\'t open the app, plug a laptop into the router\'s Ethernet port and browse to http://192.168.1.1 (router) or http://192.168.100.1 (dish).',
        opts: [['Yes – Bypass is on', 'f_bypass_on'], ['No – router mode', 'f_ssid'], ['Not sure / can\'t check', 'f_checkmode']],
      },
      a_inet: {
        q: 'Does the Starshield app show the dish as Online?',
        opts: [['No – Offline, Obstructed or Searching', 'tree:starlink:s0'], ['Yes – Online', 'f_wifi_inet']],
      },
      f_checkmode: {
        fix: 'Check which mode the Starshield router is in', sev: 'ok', model: 'starlink', step: 4,
        body: 'Check before resetting anything – a factory reset is only needed if Bypass really is on.',
        steps: [
          'In the Starshield app (on any device that can reach it): Settings → Router. It shows whether Bypass is on.',
          'Or plug a laptop into a LAN port on the Wi-Fi router. A 192.168.1.x address = router mode (correct) – reboot the router and open the case lid (see "Router mode but no Wi-Fi").',
          'No address or no link from the router\'s LAN port = likely Bypass mode. Follow "Bypass mode is on".',
          'The C1121 address does not tell you the Wi-Fi router\'s mode – the C1121 has its own feed from the combiner.',
        ],
      },
      f_bypass_on: {
        fix: 'Bypass mode is on – Wi-Fi is switched off', sev: 'warn', model: 'starlink', step: 4,
        body: 'This kit needs the Starshield router in router mode so its Wi-Fi works. Bypass can only be turned off with a factory reset of the Starshield router.',
        steps: [
          'Get approval if your SOP controls router changes. The C1121 has its own feed from the combiner, so the reset should only drop the Wi-Fi.',
          'Factory reset the Starshield router: power-cycle it 3 times in a row (on for about 2 s, off, on again), or use the reset button on routers that have one. Check the procedure for your router generation in the Starshield app or support pages.',
          'Wait for the default Wi-Fi network ("STARSHIELD" or similar) to appear, join it and open the Starshield app.',
          'Set the Wi-Fi name and password back to your unit\'s standard values. Leave Bypass OFF.',
          'Check Wi-Fi devices now get a 192.168.1.x address and internet.',
        ],
      },
      f_rtr_dark: {
        fix: 'Starshield Wi-Fi router has no lights', sev: 'warn', model: 'starlink', step: 4,
        steps: [
          'Check whether the C1121 still has internet. If it does, the dish and combiner are fine – the fault is the Wi-Fi router or its cable.',
          'Re-seat the cable from the combiner to the Wi-Fi router at both ends.',
          'Check the Wi-Fi router\'s own power lead / adapter, if it has one.',
          'Swap the combiner → router cable with a known-good one.',
          'Still dark: swap the Wi-Fi router with a spare and raise a Starshield support ticket.',
          'If the C1121 has no internet either, the problem is upstream – go to the Starshield guide (power / dish).',
        ],
      },
      f_ssid: {
        fix: 'Router mode but no Wi-Fi network visible', sev: 'ok', model: 'starlink', step: 4,
        steps: [
          'Reboot the Starshield router (app → Settings → Reboot, or unplug for 60 s). Wi-Fi takes a few minutes to come up after boot.',
          'Check in the app that the network name hasn\'t been changed or hidden.',
          'If 2.4 GHz and 5 GHz were split into separate names, look for both.',
          'Open the transit case lid, or move the device closer – a closed metal case blocks most Wi-Fi.',
          'Still nothing after a reboot with the lid open: swap the Starshield router with a spare and raise a Starshield support ticket.',
        ],
      },
      f_join: {
        fix: 'Can see the Wi-Fi but can\'t join', sev: 'ok', model: 'starlink', step: 4,
        steps: [
          'Re-enter the password – it is case-sensitive. On the device, "forget" the network and join again.',
          'If the password was changed or lost, set a new one in the Starshield app (needs a device already connected, or a laptop on the router\'s Ethernet port).',
          'Try the other band (2.4 GHz has more range; 5 GHz is faster but shorter range).',
          'Turn off "private/random MAC address" on the device if your unit uses MAC filtering.',
          'Reboot the Starshield router if many devices fail to join at once.',
        ],
      },
      f_wifi_inet: {
        fix: 'Wi-Fi connected but no internet', sev: 'ok', model: 'starlink', step: 4,
        steps: [
          'Check the device got a 192.168.1.x address (not 169.254.x.x). If it got 169.254, forget the network and rejoin, then reboot the router.',
          'Try a speed test or open the Starshield app from the device. If the app works but web pages don\'t, set DNS on the device to 1.1.1.1 or 8.8.8.8 to test.',
          'Starshield Wi-Fi clients reach the internet through the Starshield router and the combiner. They are NOT on the C1121 or secure C9200CX network, so they won\'t see secure-LAN resources – that is by design.',
          'Never bridge the Starshield Wi-Fi into the C1121 LAN or the secure switch to "fix" access. Use the C1121/C9200CX wired ports for secure traffic.',
          'If both Wi-Fi and the C1121 have no internet, go back to the Starshield guide (dish status).',
        ],
      },
      f_weak: {
        fix: 'Weak, slow or dropping Wi-Fi', sev: 'ok', model: 'starlink', step: 4,
        steps: [
          'Open the transit case lid or vents – the metal case and the C1121 next to the router block and absorb Wi-Fi.',
          'Keep the router away from generators, power supplies and the VSAT/BGAN kit.',
          'Use 5 GHz close to the case and 2.4 GHz for longer range.',
          'Too many users? Check the app for connected devices and remove unknown ones; change the password if needed.',
          'For wider coverage, add a Starshield Mesh router (or approved extender) on the Starshield side – not on the secure network.',
          'If wired devices behind the C1121 are also slow, the problem is upstream: check Statistics in the Starshield app (Starshield guide → slow).',
        ],
      },
    },
  },

  c9200cx: {
    title: 'Cisco Catalyst C9200CX-12P-2X2G (secure switch)',
    model: 'c9200cx',
    start: 'w0',
    nodes: {
      w0: {
        q: 'What is the symptom?',
        opts: [
          ['Device plugged in – no link light', 'f_link'],
          ['PoE device not powering', 'poe'],
          ['Port shuts down / amber when something is plugged in', 'f_err'],
          ['Uplink to the C1121 is down', 'uplink'],
          ['Device has link but no IP / wrong network', 'f_vlan'],
          ['802.1X / MAB authentication failing', 'f_dot1x'],
          ['Locked out of the switch', 'f_console'],
        ],
      },
      poe: { q: 'Run "show power inline". Is there budget left and what does the port say?', opts: [['Port off / faulty / power-deny', 'f_poe'], ['Port on, device still dead', 'tree:c1121:f_pd']] },
      uplink: { q: 'Is the uplink copper (Gi1/1/1-2) or SFP+ (Te1/1/3-4)?', opts: [['Copper', 'f_up_cu'], ['SFP / fiber', 'f_up_sfp']] },
      f_link: {
        fix: 'No link on an access port', sev: 'ok', model: 'c9200cx', step: 1,
        steps: ['Check the port status and whether it is admin-down or err-disabled.', 'Run the built-in TDR cable test.', 'Swap the patch cable; try a different port.', 'If the port is shut by policy (unused ports disabled for security), get approval before enabling it.'],
        cmds: `show interfaces status
show interfaces GigabitEthernet1/0/5
test cable-diagnostics tdr interface GigabitEthernet1/0/5
show cable-diagnostics tdr interface GigabitEthernet1/0/5`,
      },
      f_poe: {
        fix: 'PoE fault on the switch', sev: 'warn', model: 'c9200cx', step: 1,
        steps: ['Check the total budget vs. used. Too many high-power devices = power-deny on the last port.', 'Check the port detail for the device class and any fault.', 'Bounce the port. Test the cable (a bad pair causes PoE faults).', 'Check the switch power supply can deliver the full PoE budget.'],
        cmds: `show power inline
show power inline GigabitEthernet1/0/5 detail
configure terminal
 interface GigabitEthernet1/0/5
  power inline auto
  shutdown
  no shutdown
end`,
      },
      f_err: {
        fix: 'Port err-disabled (security violation)', sev: 'crit', model: 'c9200cx', step: 3,
        body: 'This is a SECURE switch. Port-security, BPDU guard and storm control are doing their job – confirm the device is authorised before re-enabling.',
        steps: [
          'Find the cause.',
          'psecure-violation: an unknown MAC was plugged in. Only add/clear sticky MACs for approved devices (follow your ISSM/change process).',
          'bpduguard: someone plugged a switch/hub into an access port – remove it.',
          'Then bounce the port to recover.',
        ],
        cmds: `show interfaces status err-disabled
show errdisable recovery
show port-security interface GigabitEthernet1/0/5
show port-security address
! after the device is approved:
clear port-security sticky interface GigabitEthernet1/0/5
configure terminal
 interface GigabitEthernet1/0/5
  shutdown
  no shutdown
end`,
      },
      f_up_cu: {
        fix: 'Copper uplink to C1121 down', sev: 'warn', model: 'c9200cx', step: 2,
        steps: ['Check the cable between C9200CX Gi1/1/x and the C1121 LAN port.', 'Both ends must agree: trunk with the same allowed/native VLANs, or both access in the same VLAN.', 'Use CDP/LLDP to confirm the neighbor.', 'If DHCP snooping is enabled, the uplink must be trusted.'],
        cmds: `show interfaces GigabitEthernet1/1/1
show interfaces trunk
show cdp neighbors detail
configure terminal
 interface GigabitEthernet1/1/1
  switchport mode trunk
  switchport trunk allowed vlan 10,20,99
  ip dhcp snooping trust
  no shutdown
end`,
      },
      f_up_sfp: {
        fix: 'SFP+ uplink down', sev: 'warn', model: 'c9200cx', step: 2,
        steps: ['Check the transceiver is recognised and supported, and look at Tx/Rx light levels.', 'Clean both fiber ends and the optic with a one-click cleaner. Inspect with a scope if available.', 'Swap Tx/Rx strands if Rx is very low/none.', 'Optic types must match at both ends (SR/LR, single-mode vs multi-mode, 1G vs 10G).', 'Re-seat or swap the SFP – see the 3D view.'],
        cmds: `show interfaces TenGigabitEthernet1/1/3 status
show interfaces TenGigabitEthernet1/1/3 transceiver detail
show inventory
show logging | include SFP|TRANSCEIVER`,
      },
      f_vlan: {
        fix: 'Wrong VLAN / no DHCP', sev: 'warn', model: 'c9200cx', step: 1,
        steps: ['Check the access VLAN on the port.', 'Check the MAC is learned on that port.', 'DHCP snooping: the uplink toward the DHCP server (C1121) must be trusted, or DHCP offers are dropped.', 'Check the VLAN exists and is allowed on the uplink trunk.'],
        cmds: `show vlan brief
show interfaces GigabitEthernet1/0/5 switchport
show mac address-table interface GigabitEthernet1/0/5
show ip dhcp snooping
show ip dhcp snooping binding
show interfaces trunk`,
      },
      f_dot1x: {
        fix: '802.1X / MAB failures', sev: 'warn', model: 'c9200cx', step: 1,
        steps: ['Check the session state and which method failed.', 'RADIUS/ISE must be reachable (often over the Starshield/VPN path – if the WAN is down, auth fails; check critical-VLAN/fallback config).', 'Check the client certificate/credentials and supplicant config.', 'For MAB devices (printers, cameras), confirm the MAC is in the policy server.'],
        cmds: `show access-session interface GigabitEthernet1/0/5 details
show aaa servers
test aaa group radius <user> <password> new-code
show logging | include DOT1X|MAB|RADIUS`,
      },
      f_console: {
        fix: 'Console & password recovery', sev: 'warn', model: 'c9200cx', step: 3,
        steps: ['Console: RJ45 or USB-C, 9600 8N1, no flow control.', 'Recovery (only with authorisation; may be disabled by "no service password-recovery"): unplug power, hold the MODE button while powering on until the switch: prompt appears.', 'Run the commands below, set new credentials, and save.'],
        cmds: `switch: SWITCH_IGNORE_STARTUP_CFG=1
switch: boot
Switch> enable
Switch# copy startup-config running-config
Switch# configure terminal
Switch(config)# enable secret <NEW-SECRET>
Switch(config)# no system ignore startupconfig switch all
Switch(config)# end
Switch# write memory`,
      },
    },
  },

  cabling: {
    title: 'Cabling (Ethernet, fiber, Starshield, coax)',
    model: 'rj45',
    start: 'k0',
    nodes: {
      k0: { q: 'Which cable are you troubleshooting?', opts: [['Ethernet (Cat5e/Cat6)', 'k_eth'], ['Starshield dish cable', 'tree:starlink:f_cable'], ['VSAT IFL coax', 'tree:vsat:f_ifl'], ['Fiber patch', 'f_fiber']] },
      k_eth: { q: 'What does a cable tester show?', opts: [['Open / miswire / short on a pin', 'f_reterm'], ['Passes, but link is intermittent or slow', 'f_intermittent'], ['I don\'t have a tester', 'f_notester']] },
      f_reterm: { fix: 'Re-terminate the RJ45 end', sev: 'ok', model: 'rj45', step: 1, steps: ['Follow the 3D steps: cut, strip, order T568B, insert, crimp, test.', 'T568B: White/Orange, Orange, White/Green, Blue, White/Blue, Green, White/Brown, Brown.', 'Both ends must use the same standard (straight-through).', 'Re-test. For PoE, all pairs must be good.'] },
      f_intermittent: { fix: 'Intermittent link', sev: 'ok', model: 'rj45', step: 4, steps: ['Look for a broken latch tab, kinked or crushed cable, or a cable run beside generator/power cables.', 'Check interface errors (CRC/input errors) on the switch/router – rising counters = bad cable.', 'Replace patch cords first, then test the permanent run.', 'Keep runs under 100 m.'] },
      f_notester: { fix: 'Testing without a cable tester', sev: 'ok', model: 'rj45', step: 0, steps: ['Swap with a known-good patch cord – fastest test.', 'Use the C9200CX TDR test: "test cable-diagnostics tdr interface Gi1/0/x".', 'Check link speed: a 100 Mb link on a gigabit device often means a bad pair.', 'Check interface error counters.'] },
      f_fiber: { fix: 'Fiber patch problems', sev: 'ok', model: 'c9200cx', step: 2, steps: ['Clean both connectors every time you unplug. Keep dust caps on.', 'Swap Tx/Rx if there is no Rx light.', 'Respect bend radius – no tight loops or kinks.', 'Single-mode (yellow) vs multi-mode (aqua/orange) must match the optics.'] },
    },
  },

  vsat: {
    title: 'LS248 VSAT (1.3 m flyaway)',
    model: 'vsat',
    start: 'v0',
    nodes: {
      v0: {
        q: 'What is the modem status?',
        help: 'Check the front-panel LEDs (Power / RX / TX / NET or similar) or the modem web/CLI status.',
        opts: [['No power / no LEDs', 'f_vpwr'], ['RX not locked', 'v_rx'], ['RX locked, but TX/NET down (not in network)', 'f_tx'], ['In network, but no traffic or very slow', 'f_traffic']],
      },
      v_rx: { q: 'Has the antenna completed auto-acquire / is it pointed at the correct satellite?', opts: [['No – positioner error or never finishes', 'f_pos'], ['Yes – pointed, still no RX lock', 'v_rx2'], ['Not sure', 'f_pos']] },
      v_rx2: { q: 'Is there any RX signal (modem RX power / spectrum analyzer)?', opts: [['No signal at all', 'f_lnb'], ['Signal present but low SNR / Eb/No', 'f_peak']] },
      f_vpwr: { fix: 'Modem / case has no power', sev: 'crit', model: 'vsat', step: 5, steps: ['The LS-248 needs 90–264 VAC or 24–32 VDC. Check the source is inside that range – a low generator or vehicle battery under 24 V will not run it.', 'Check AC/DC input to the transit case, the case breaker/switch and fuses.', 'Check the internal PSU and the modem power lead.', 'Try a different generator/UPS outlet.', 'Swap PSU/modem from spares; reload the modem option file/config.'] },
      f_pos: {
        fix: 'Positioner / pointing fault', sev: 'warn', model: 'vsat', step: 4,
        steps: [
          'Level the tripod/base (bubble level), lock legs and stake/ballast.',
          'Give the GPS clear sky; let it get a fix. Re-run compass calibration away from vehicles/metal.',
          'Check the positioner controller cable is seated; clear any limit or stow faults and retry acquire.',
          'Confirm the correct satellite, longitude, polarisation and beacon/carrier are loaded.',
          'Manual pointing: calculate azimuth/elevation/polarisation from your lat/long and satellite longitude; point roughly, then peak on RX signal.',
        ],
      },
      f_lnb: {
        fix: 'No RX signal – LNB / RX IFL', sev: 'warn', model: 'vsat', step: 3,
        steps: [
          'Check the modem has LNB DC power enabled and the voltage at the LNB end.',
          'Inspect the RX IFL coax and connectors (tight, dry, not crushed). Swap the IFL.',
          'TX and RX IFLs swapped? RX goes to the LNB.',
          'Check LNB LO frequency in the modem config matches the fitted LNB.',
          'Swap the LNB from spares (see 3D step – power off first).',
        ],
      },
      f_peak: {
        fix: 'Low SNR – peak & inspect', sev: 'ok', model: 'vsat', step: 1,
        steps: ['Peak azimuth, elevation, then polarisation on the RX signal.', 'Check all reflector petals are latched with no gaps or steps.', 'Check the feed horn cover is intact and there is no water in the feed/OMT.', 'Rain/snow fade: wait it out or use the higher-margin link profile.', 'Check nothing obstructs the beam path (trees, vehicles, the Starshield dish, buildings).'],
      },
      f_tx: {
        fix: 'Not transmitting / not in network', sev: 'crit', model: 'vsat', step: 3,
        body: 'Do NOT transmit until pointing and cross-pol are verified with the hub/NOC. Mis-pointed transmit interferes with other users.',
        steps: [
          'Verify the modem TX is enabled and the site location (lat/long) is correct in the modem.',
          'Check BUC DC power and 10 MHz reference are enabled in the modem configuration.',
          'Check the BUC fault LED/temperature and the TX IFL (tight, dry, correct port).',
          'Call the NOC for a cross-pol/line-up check; confirm TX power and the modem option file/credentials are current.',
          'Swap the BUC from spares if it reports a fault (see 3D step).',
        ],
      },
      f_ifl: { fix: 'IFL coax faults', sev: 'ok', model: 'vsat', step: 5, steps: ['Hand-tighten N/F connectors fully; weather-seal outdoor joints.', 'Look for crushed sections (vehicle tracks, doors), kinks and water ingress.', 'Measure continuity/shorts with power OFF.', 'Swap with a spare IFL of the correct length/type.'] },
      f_traffic: {
        fix: 'In network but no traffic', sev: 'ok', model: 'vsat', step: 5,
        steps: ['Check the modem LAN port link to your router/switch and the LAN IP/routes.', 'If an inline network encryptor is fitted, check it is keyed, up and its tunnels are established (per COMSEC SOP).', 'Check the NOC has the correct bandwidth/QoS profile applied.', 'Remember ~600 ms latency on GEO links – tune TCP/MTU for VPNs.'],
      },
    },
  },

  grrip: {
    title: 'GRRIP – Klas Pioneer Express 5.1 (AN/PSC-19)',
    model: 'grrip',
    start: 'g0',
    nodes: {
      g0: {
        q: 'What is the problem with the GRRIP kit?',
        help: 'Pioneer Express 5.1: a single IP67 case with the core module (red and black networking, UPS, 250 W AC/DC), a built-in Panasonic laptop, and space for a KG-250XS HAIPE or GoSilent Cube. The Hughes 9211 BGAN terminal and the encryptor are separate items.',
        opts: [
          ['Kit has no power / won\'t stay on', 'g_pwr'],
          ['BGAN or laptop not charging from the kit', 'f_15v'],
          ['No reachback – black side has no BGAN / hotel / VSAT link', 'g_black'],
          ['Black side works but no secure connection', 'g_crypto'],
          ['A red laptop gets no network', 'g_red'],
          ['Built-in laptop won\'t boot', 'f_laptop'],
          ['Kit is overheating or too cold', 'f_temp'],
        ],
      },
      g_pwr: {
        q: 'What external power is connected to the core module?',
        opts: [['AC mains / generator', 'f_pwr_ac'], ['DC – 2590 battery or vehicle', 'f_pwr_dc'], ['Nothing – running on the internal UPS', 'f_ups']],
      },
      f_pwr_ac: {
        fix: 'No power on AC', sev: 'crit', model: 'grrip', step: 1,
        steps: [
          'Check the outlet or generator output with another device.',
          'Re-seat the AC cord at the core module. The core module has a built-in 250 W AC/DC supply – no external brick.',
          'Check the core module power switch is on.',
          'Try DC power instead (2590 battery with the supplied DC cable). If DC works, the AC side of the core module may have failed.',
          'If neither AC nor DC powers it, raise a fault with Klas support and your unit\'s maintenance channel.',
        ],
      },
      f_pwr_dc: {
        fix: 'No power on DC / 2590 battery', sev: 'crit', model: 'grrip', step: 1,
        steps: [
          'Check the 2590 battery is charged (use its state-of-charge indicator if it has one). Swap to a known-good 2590.',
          'Use the supplied DC cable from the 2590 to the core module DC input connector. Re-seat both ends fully.',
          'Inspect the DC cable and connector for bent pins, cuts or corrosion.',
          'Try AC power to rule out the DC input.',
        ],
      },
      f_ups: {
        fix: 'Running on the internal UPS only', sev: 'warn', model: 'grrip', step: 1,
        body: 'The 72 Wh UPS bridges power drops. It is not a long-term power source.',
        steps: [
          'The UPS backs up only the VoyagerVMm and the HAIPE / GoSilent. The laptop and BGAN run on their own batteries.',
          'The 15 VDC charging outputs are OFF on UPS power – nothing gets charged until AC or DC is connected again.',
          'Connect AC or a 2590 battery as soon as possible; expect limited runtime on UPS alone.',
          'Save work and follow your SOP for an orderly shutdown if external power can\'t be restored.',
        ],
      },
      f_15v: {
        fix: 'BGAN or laptop not charging', sev: 'warn', model: 'grrip', step: 2,
        steps: [
          'The core module\'s two 15 VDC outputs are only live when external AC or DC power is connected – they are off on UPS power.',
          'Connect external power, then re-seat the charge cable at the 15 VDC output and at the BGAN / laptop.',
          'Try the other 15 VDC output and a known-good charge cable.',
          'The Hughes 9211 can also charge from its own adapter; the laptop from its own charger.',
        ],
      },
      g_black: {
        q: 'Which black-side bearer are you using?',
        help: 'The black side is the encrypted (ciphertext) side. Pioneer Express supports BGAN, hotel broadband and VSAT, with 4 black user ports on the VoyagerVMm.',
        opts: [['Hughes 9211 BGAN', 'tree:bgan:b0'], ['Starshield', 'f_black_ss'], ['Hotel / local broadband', 'f_hotel'], ['VSAT', 'tree:vsat:v0'], ['Not sure / any bearer', 'f_black']],
      },
      f_black: {
        fix: 'Black-side link down', sev: 'warn', model: 'grrip', step: 3,
        steps: [
          'Check the bearer (BGAN, hotel network or VSAT modem) is cabled to a BLACK user port on the core module – never a red port.',
          'Check the link light on that black port. Swap the patch cable.',
          'From a black laptop, confirm the bearer gives an IP address and internet access.',
          'Captive portals (hotels) must be cleared from a BLACK laptop before the secure tunnel can come up.',
          'If the bearer works on a black laptop but not through the kit, escalate to your network/NOC team.',
        ],
      },
      f_black_ss: {
        fix: 'Starshield as the GRRIP black-side link', sev: 'ok', model: 'grrip', step: 3,
        steps: [
          'Cable the Starshield network into a BLACK user port on the core module – never a red port.',
          'Check Starshield itself is online first (Starshield guide → dish status). A black laptop should get internet on that cable.',
          'Starshield gives far more bandwidth than BGAN (hundreds of Mbps vs ~650 kbps) and lower latency – but the GRRIP encryptor and its own limits still apply.',
          'If Starshield is up but the secure tunnel won\'t form, check the encryptor (black side up but no secure connection).',
        ],
      },
      f_hotel: {
        fix: 'Hotel / local broadband on the black side', sev: 'ok', model: 'grrip', step: 3,
        steps: [
          'Plug the hotel or local Ethernet into a BLACK user port – never a red port.',
          'Clear any captive portal (login / accept page) from a black laptop first.',
          'Confirm DHCP: the black side should get an IP address from the hotel network.',
          'Some networks block VPN/HAIPE traffic. If the black side has internet but the secure tunnel won\'t form, switch to BGAN or report it to your NOC.',
          'Never connect a hotel or untrusted network to the red side.',
        ],
      },
      g_crypto: {
        q: 'Which encryptor is fitted in the core module?',
        opts: [['Viasat KG-250XS (Type 1 HAIPE)', 'f_haipe'], ['GoSilent Cube (CSfC)', 'f_gosilent'], ['Not sure', 'f_crypto_id']],
      },
      f_haipe: {
        fix: 'KG-250XS HAIPE – no secure tunnel', sev: 'warn', model: 'grrip', step: 5,
        body: 'COMSEC: only authorised personnel may key, zeroize or handle the HAIPE. Report alarms, zeroized or unkeyed states to your COMSEC custodian / ISSM – do not attempt keying yourself unless you are authorised.',
        steps: [
          'Check the HAIPE is powered (status indicator lit). It runs from the core module UPS.',
          'Check its black (ciphertext) cable to the black side and its red (plaintext) cable to the red side are seated – do not swap them.',
          'Confirm the black side has internet first (black laptop test).',
          'Note any alarm or status message exactly, for the custodian/NOC.',
          'Power-cycle only if your SOP allows it. Escalate through your COMSEC and network channels.',
        ],
      },
      f_gosilent: {
        fix: 'GoSilent Cube – no secure tunnel', sev: 'warn', model: 'grrip', step: 5,
        body: 'CSfC: changes to the GoSilent configuration are for your CSfC administrator only.',
        steps: [
          'Check its power: 5 V 2 A over micro-USB. Re-seat the micro-USB cable; try a known-good cable.',
          'Check the black-side and red-side network cables are seated in the right ports.',
          'Confirm the black side has internet first (black laptop test).',
          'Note the status lights / messages and escalate to your CSfC administrator or NOC.',
        ],
      },
      f_crypto_id: {
        fix: 'Identify the encryptor', sev: 'ok', model: 'grrip', step: 5,
        steps: [
          'KG-250XS: a Viasat Type 1 HAIPE (controlled item – handle per COMSEC rules). Check the label on the unit.',
          'GoSilent Cube: a small CSfC firewall cube powered by micro-USB.',
          'Neither is included with the Pioneer Express kit itself – check your hand receipt / kit list.',
          'Then go back and pick the matching device.',
        ],
      },
      g_red: {
        q: 'Which red laptop has no network?',
        help: 'The red side is the plaintext (secure) network. 5 red user ports on the VoyagerVMm, including the built-in laptop; up to 4 external red laptops.',
        opts: [['The built-in Panasonic laptop', 'f_red_int'], ['An external red laptop', 'f_red_ext']],
      },
      f_red_ext: {
        fix: 'External red laptop – no network', sev: 'ok', model: 'grrip', step: 4,
        steps: [
          'Plug it into a RED user port – never a black port. Up to 4 external red laptops are supported.',
          'Check the port link light and swap the patch cable.',
          'Check the laptop gets an address from the red-side router (KlasOS Keel or a VNF such as Cisco Catalyst 8000v), or uses the static IP from your SOP.',
          'If the built-in laptop works but this one doesn\'t, the fault is the laptop or its cable.',
          'If no red device works, check the encryptor (black side up but no secure connection).',
        ],
      },
      f_red_int: {
        fix: 'Built-in laptop – no network', sev: 'ok', model: 'grrip', step: 4,
        steps: [
          'Check the laptop\'s network cable to its red port on the core module.',
          'Restart the laptop network adapter; check it has a red-side address.',
          'Try an external red laptop on another red port to see if the red side is up.',
          'If the red side is down for everyone, the VoyagerVMm red router (KlasOS Keel / VNF) may need restarting per your SOP – escalate if unsure.',
        ],
      },
      f_laptop: {
        fix: 'Built-in laptop won\'t boot', sev: 'warn', model: 'grrip', step: 6,
        steps: [
          'Charge it: connect external power to the kit and use a 15 VDC output, or the laptop charger.',
          'Check the quick-release 512 GB OPAL SSD is fully seated and locked. It is an encrypted drive – use only the SSD issued for this kit.',
          'Hold the power button 10 s to force off, then power on again.',
          'BIOS is a custom federal BIOS – don\'t change BIOS settings unless your SOP says so.',
          'Still dead: swap the laptop/SSD per your maintenance process.',
        ],
      },
      f_temp: {
        fix: 'Temperature limits', sev: 'ok', model: 'grrip', step: 0,
        steps: [
          'Operating range is −20 °C to 40 °C (storage −20 °C to 60 °C).',
          'In heat: shade the kit, keep it off hot ground, and give the core module space to breathe.',
          'In cold: let the kit warm up before powering on; batteries lose capacity in the cold.',
          'The case is IP67 sealed only when closed and latched – protect an open kit from rain and dust.',
        ],
      },
    },
  },

  bgan: {
    title: 'GRRIP – Hughes 9211 BGAN terminal',
    model: 'bgan',
    start: 'b0',
    nodes: {
      b0: { q: 'Does the BGAN terminal power on?', opts: [['No', 'f_bpwr'], ['Yes', 'b1']] },
      b1: { q: 'Has the terminal got a GPS fix?', opts: [['No / waiting for GPS', 'f_gps'], ['Yes', 'b2']] },
      b2: { q: 'During pointing, can you reach a good signal strength (pointing tone/bar above the threshold)?', opts: [['No', 'f_point'], ['Yes', 'b3']] },
      b3: { q: 'Is the terminal registered on the BGAN network?', opts: [['No – registration fails', 'f_reg'], ['Yes', 'b4']] },
      b4: { q: 'What isn\'t working?', opts: [['Data / internet', 'f_data'], ['Voice calls (handset)', 'f_bvoice'], ['Works but slow', 'f_bslow']] },
      f_bpwr: { fix: 'No power', sev: 'crit', model: 'bgan', step: 1, steps: ['Swap in a charged battery (3D step 1).', 'Run from the AC/DC adapter or vehicle power instead of battery.', 'Charge from a Pioneer Express 15 VDC output – it is only live when the kit has AC or DC external power (not on UPS).', 'Cold batteries lose capacity – keep spares warm.'] },
      f_gps: { fix: 'No GPS fix', sev: 'warn', model: 'bgan', step: 4, steps: ['Place the terminal outdoors with open sky; keep away from buildings and vehicles.', 'Wait several minutes for the first fix after moving a long distance.', 'The terminal cannot register until it has a valid position.'] },
      f_point: { fix: 'Can\'t get a pointing signal', sev: 'warn', model: 'bgan', step: 4, steps: ['Use the terminal\'s azimuth/elevation (or a pointing app). Inmarsat satellites are over the equator – face roughly south in the northern hemisphere, north in the southern.', 'Rotate slowly through the azimuth, then adjust tilt, watching the bar/tone peak.', 'Clear line of sight – no trees, walls, vehicles or people in front.', 'Near the edge of coverage (high latitudes) elevation is very low – find high ground.'] },
      f_reg: { fix: 'Registration fails', sev: 'warn', model: 'bgan', step: 2, steps: ['Re-seat the SIM (3D step 2) and check the PIN; 3 wrong PINs = PUK needed from the provider.', 'Confirm the SIM is active with airtime/credit and enabled for the services needed.', 'Point again for maximum signal, then retry.', 'Power-cycle the terminal.', 'Contact the service provider with the IMSI/SIM number if it still won\'t register.'] },
      f_data: { fix: 'No data', sev: 'ok', model: 'bgan', step: 3, body: 'BGAN on its own carries UNCLASSIFIED traffic only. Classified traffic must go through the GRRIP encryptor.', steps: ['Connect the laptop/router to the LAN port (or Wi-Fi if the terminal has it) and get an IP by DHCP.', 'Open the terminal web UI and start a data connection (Standard IP / background, or a Streaming class if needed).', 'Check the APN/connection profile matches your SIM.', 'If a router sits behind the BGAN, check its WAN gets an address from the terminal.', 'VPN issues: lower MTU/MSS; GEO latency is ~700+ ms.'] },
      f_bvoice: { fix: 'Voice calls fail', sev: 'ok', model: 'bgan', step: 3, steps: ['Connect the handset to the phone (RJ11) port and check dial tone.', 'Dial in international format: 00 + country code + number + # (or as per the terminal guide).', 'Confirm voice is enabled on the SIM.', 'Make sure signal is strong and registration is complete.'] },
      f_bslow: { fix: 'Slow BGAN data', sev: 'ok', model: 'bgan', step: 4, body: 'BGAN is ~650 kbps at best and GEO latency is high – it will never feel like broadband. Airtime is very expensive, so keep traffic to what the mission needs.', steps: ['Standard IP is shared/contended; use a streaming class for guaranteed rates (charged by time).', 'Peak the antenna again – signal affects throughput.', 'Stop background updates (OS, cloud sync) on laptops – they eat airtime.', 'Use compression/acceleration tools if available.'] },
    },
  },

  satphone: {
    title: 'Satellite phone',
    model: 'satphone',
    start: 'p0',
    nodes: {
      p0: { q: 'Does the phone power on?', opts: [['No', 'f_ppwr'], ['Yes', 'p1']] },
      p1: { q: 'What is the problem?', opts: [['No signal / "searching"', 'p_sky'], ['Has signal but calls fail or drop', 'f_pcall'], ['SMS / data problem', 'f_psms']] },
      p_sky: { q: 'Are you outdoors, with a clear view of the sky and the antenna fully extended pointing straight up?', opts: [['No', 'f_psky'], ['Yes', 'f_preg']] },
      f_ppwr: { fix: 'Phone won\'t power on', sev: 'crit', model: 'satphone', step: 2, steps: ['Fit a charged battery (3D step 2). Check battery contacts are clean.', 'Charge on the wall/USB/vehicle charger for 15 minutes and retry.', 'Cold kills batteries – warm the battery inside your clothing.'] },
      f_psky: { fix: 'Get a clear sky view', sev: 'warn', model: 'satphone', step: 1, steps: ['Go outside – sat phones do not work indoors or in vehicles without an external antenna.', 'Extend the antenna fully and point it straight up.', 'Move away from tall buildings, trees and hills.', 'Geostationary-network phones (e.g. Inmarsat IsatPhone) also need a view toward the equator.'] },
      f_preg: { fix: 'Still no network registration', sev: 'warn', model: 'satphone', step: 3, steps: ['Wait 2–3 minutes for registration after power-on.', 'Re-seat the SIM (3D step 3); check the PIN/PUK.', 'Confirm the SIM is active with airtime/minutes remaining and not expired.', 'Power-cycle the phone.', 'Inspect/replace the antenna if cracked or the hinge is loose (3D step 1).', 'In buildings/vehicles use the external antenna or docking station.'] },
      f_pcall: { fix: 'Calls fail / drop', sev: 'ok', model: 'satphone', step: 1, steps: ['Dial in full international format: + or 00, then country code, then number (e.g. 00 1 555 123 4567).', 'To call a sat phone from a landline, dial its full international number (Iridium numbers usually start +8816).', 'Stand still during the call – walking under trees or near walls drops the link.', 'Check minutes balance and that outgoing calls aren\'t barred.'] },
      f_psms: { fix: 'SMS / data issues', sev: 'ok', model: 'satphone', step: 3, steps: ['Check the SMS service-centre number in the phone settings matches your provider.', 'Send to full international format numbers.', 'Data via sat phone is very slow – use the provider\'s data kit/drivers and compression.'] },
    },
  },
};
