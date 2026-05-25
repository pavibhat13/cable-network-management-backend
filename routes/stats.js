const express = require('express');
const JointBox = require('../models/JointBox');

const router = express.Router();

/**
 * GET /api/stats
 * Returns aggregated statistics for the cable network:
 *   - totalBoxes: total number of joint boxes
 *   - totalByArea: count per area
 *   - totalByCross: count per cross
 *   - signalHealth: green (outputDbm > 5), yellow (0-5), red (< 0)
 *   - edgaPortsUsed: count of distinct EDFA ports in use
 *   - lowSignalBoxes: boxes where outputDbm < 0
 */
router.get('/', async (req, res) => {
  try {
    // Total count
    const totalBoxes = await JointBox.countDocuments();

    // Count by area
    const areaAgg = await JointBox.aggregate([
      { $group: { _id: '$area', count: { $sum: 1 } } }
    ]);
    const totalByArea = { Medarakeri: 0, Bandikeri: 0 };
    for (const entry of areaAgg) {
      if (entry._id) totalByArea[entry._id] = entry.count;
    }

    // Count by cross
    const crossAgg = await JointBox.aggregate([
      { $group: { _id: '$cross', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    const totalByCross = {};
    for (const entry of crossAgg) {
      if (entry._id) totalByCross[entry._id] = entry.count;
    }

    // Signal health: Good vs Critical per coupler type thresholds
    const GOOD_THRESHOLD = {
      '1x4': 11, '1x8': -1, '50x50': -3,
      '1x4+1x8': -1, '50x50+50x50': -3, 'joint_only': -1
    };
    const allBoxes = await JointBox.find(
      {},
      { customerId: 1, customerName: 1, outputDbm: 1, couplerType: 1, area: 1, cross: 1 }
    ).lean();
    let goodCount = 0, criticalCount = 0;
    const lowSignalBoxes = [];
    for (const box of allBoxes) {
      const threshold = GOOD_THRESHOLD[box.couplerType] ?? -1;
      if ((box.outputDbm ?? 0) >= threshold) {
        goodCount++;
      } else {
        criticalCount++;
        lowSignalBoxes.push(box);
      }
    }
    const signalHealth = { green: goodCount, red: criticalCount };
    lowSignalBoxes.sort((a, b) => (a.outputDbm ?? 0) - (b.outputDbm ?? 0));

    // Count of distinct EDFA ports in use
    const edfaPortsUsedAgg = await JointBox.aggregate([
      { $match: { edgaPortNo: { $exists: true, $ne: '' } } },
      { $group: { _id: '$edgaPortNo' } },
      { $count: 'count' }
    ]);
    const edfaPortsUsed = edfaPortsUsedAgg.length > 0 ? edfaPortsUsedAgg[0].count : 0;

    res.json({
      total: totalBoxes,
      byArea: totalByArea,
      byCross: totalByCross,
      bySignal: signalHealth,
      edfaPortsUsed,
      lowSignalBoxes
    });
  } catch (err) {
    console.error('[GET /stats]', err.message);
    res.status(500).json({ error: 'Failed to fetch statistics.' });
  }
});

module.exports = router;
