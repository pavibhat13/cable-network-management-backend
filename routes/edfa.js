const express = require('express');
const JointBox = require('../models/JointBox');

const router = express.Router();

/**
 * Known EDFA port mappings (hardcoded per network documentation).
 */
const KNOWN_PORT_MAPPINGS = {
  1: 'Bandikeri 7th Cross',
  3: 'Bandikeri 3rd Cross',
  4: 'Bandikeri 3rd Cross',
  6: 'Bandikeri 2nd Cross',
  8: 'Bandikeri 1st Cross',
  9: 'Bandikeri 4th + 5th Cross'
};

/**
 * GET /api/edfa/ports
 * Returns an array of 16 EDFA port slots (1-16).
 * Each port entry includes:
 *   portNo, inUse (bool), area, cross, boxCount, customerIds, knownMapping
 *
 * Data is aggregated from joint boxes that have an edgaPortNo set.
 */
router.get('/ports', async (req, res) => {
  try {
    // Fetch all joint boxes that have an edgaPortNo
    const boxes = await JointBox.find(
      { edgaPortNo: { $exists: true, $ne: '' } },
      { customerId: 1, customerName: 1, area: 1, cross: 1, edgaPortNo: 1 }
    ).lean();

    // Group boxes by edgaPortNo
    const portMap = {};
    for (const box of boxes) {
      const portNo = box.edgaPortNo;
      if (!portMap[portNo]) {
        portMap[portNo] = {
          areas: new Set(),
          crosses: new Set(),
          boxCount: 0,
          customerIds: []
        };
      }
      portMap[portNo].areas.add(box.area);
      portMap[portNo].crosses.add(box.cross);
      portMap[portNo].boxCount += 1;
      portMap[portNo].customerIds.push(box.customerId);
    }

    // Build the 16-slot port array
    const ports = [];
    for (let portNo = 1; portNo <= 16; portNo++) {
      const portStr = String(portNo);
      const portData = portMap[portStr];
      const knownMapping = KNOWN_PORT_MAPPINGS[portNo] || null;

      if (portData) {
        ports.push({
          portNo,
          inUse: true,
          area: Array.from(portData.areas).join(', '),
          cross: Array.from(portData.crosses).join(', '),
          boxCount: portData.boxCount,
          customerIds: portData.customerIds,
          knownMapping
        });
      } else {
        ports.push({
          portNo,
          inUse: false,
          area: null,
          cross: null,
          boxCount: 0,
          customerIds: [],
          knownMapping
        });
      }
    }

    res.json(ports);
  } catch (err) {
    console.error('[GET /edfa/ports]', err.message);
    res.status(500).json({ error: 'Failed to fetch EDFA port data.' });
  }
});

module.exports = router;
