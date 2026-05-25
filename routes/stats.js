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

    // Signal health buckets based on outputDbm
    const [greenCount, yellowCount, redCount] = await Promise.all([
      JointBox.countDocuments({ outputDbm: { $gt: 5 } }),
      JointBox.countDocuments({ outputDbm: { $gte: 0, $lte: 5 } }),
      JointBox.countDocuments({ outputDbm: { $lt: 0 } })
    ]);
    const signalHealth = {
      green: greenCount,
      yellow: yellowCount,
      red: redCount
    };

    // Count of distinct EDFA ports in use
    const edgaPortsUsedAgg = await JointBox.aggregate([
      { $match: { edgaPortNo: { $exists: true, $ne: '' } } },
      { $group: { _id: '$edgaPortNo' } },
      { $count: 'count' }
    ]);
    const edgaPortsUsed = edgaPortsUsedAgg.length > 0 ? edgaPortsUsedAgg[0].count : 0;

    // Low signal boxes (outputDbm < 0)
    const lowSignalBoxes = await JointBox.find(
      { outputDbm: { $lt: 0 } },
      { customerId: 1, customerName: 1, outputDbm: 1, area: 1, cross: 1, _id: 0 }
    ).sort({ outputDbm: 1 }).lean();

    res.json({
      totalBoxes,
      totalByArea,
      totalByCross,
      signalHealth,
      edgaPortsUsed,
      lowSignalBoxes
    });
  } catch (err) {
    console.error('[GET /stats]', err.message);
    res.status(500).json({ error: 'Failed to fetch statistics.' });
  }
});

module.exports = router;
