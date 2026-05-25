const express = require('express');
const JointBox = require('../models/JointBox');

const router = express.Router();

const MAX_HOPS = 10;

/**
 * Recursively builds the downstream signal chain by following forwardsTo arrays.
 * @param {string} customerId - The starting customer ID
 * @param {number} hops - Current hop count (to prevent infinite loops)
 * @returns {Promise<Array>} Array of downstream joint box objects with nested children
 */
async function buildDownstream(customerId, hops = 0) {
  if (hops >= MAX_HOPS) return [];

  const box = await JointBox.findOne({ customerId }).lean();
  if (!box || !box.forwardsTo || box.forwardsTo.length === 0) return [];

  const children = [];
  for (const targetId of box.forwardsTo) {
    const targetBox = await JointBox.findOne({ customerId: targetId }).lean();
    if (targetBox) {
      const nested = await buildDownstream(targetId, hops + 1);
      children.push({ ...targetBox, downstream: nested });
    }
  }
  return children;
}

/**
 * Finds all boxes that directly forward to a given customerId (one level upstream).
 * @param {string} customerId
 * @returns {Promise<Array>}
 */
async function findUpstream(customerId) {
  const upstreamBoxes = await JointBox.find({ forwardsTo: customerId }).lean();
  return upstreamBoxes;
}

/**
 * GET /api/chain/:customerId
 * Returns the full signal chain for a joint box:
 *   - box: the box itself
 *   - upstream: boxes that forward signals to this box (one level)
 *   - downstream: full recursive tree of boxes this box forwards to
 */
router.get('/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;

    const box = await JointBox.findOne({ customerId }).lean();
    if (!box) {
      return res.status(404).json({ error: `Joint box with customerId '${customerId}' not found.` });
    }

    // Build downstream tree (follow forwardsTo recursively)
    const downstream = await buildDownstream(customerId);

    // Find upstream (who forwards to this box)
    const upstream = await findUpstream(customerId);

    res.json({
      box,
      upstream,
      downstream
    });
  } catch (err) {
    console.error('[GET /chain/:customerId]', err.message);
    res.status(500).json({ error: 'Failed to build signal chain.' });
  }
});

module.exports = router;
