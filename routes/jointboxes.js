const express = require('express');
const mongoose = require('mongoose');
const JointBox = require('../models/JointBox');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/jointboxes
 * Returns all joint boxes. Supports optional query params:
 *   area, cross, couplerType, edgaPortNo — exact match filters
 *   search — regex search across customerId, customerName, doorNo
 */
router.get('/', async (req, res) => {
  try {
    const { area, cross, couplerType, edgaPortNo, search } = req.query;
    const filter = {};

    if (area) filter.area = area;
    if (cross) filter.cross = cross;
    if (couplerType) filter.couplerType = couplerType;
    if (edgaPortNo) filter.edgaPortNo = edgaPortNo;

    if (search) {
      const regex = new RegExp(search, 'i');
      filter.$or = [
        { customerId: regex },
        { customerName: regex },
        { doorNo: regex }
      ];
    }

    const boxes = await JointBox.find(filter).sort({ area: 1, cross: 1, customerName: 1 });
    res.json(boxes);
  } catch (err) {
    console.error('[GET /jointboxes]', err.message);
    res.status(500).json({ error: 'Failed to fetch joint boxes.' });
  }
});

/**
 * GET /api/jointboxes/area/:area
 * Returns all joint boxes filtered by area.
 */
router.get('/area/:area', async (req, res) => {
  try {
    const boxes = await JointBox.find({ area: req.params.area }).sort({ cross: 1, customerName: 1 });
    res.json(boxes);
  } catch (err) {
    console.error('[GET /jointboxes/area/:area]', err.message);
    res.status(500).json({ error: 'Failed to fetch joint boxes by area.' });
  }
});

/**
 * GET /api/jointboxes/cross/:cross
 * Returns all joint boxes filtered by cross.
 */
router.get('/cross/:cross', async (req, res) => {
  try {
    const boxes = await JointBox.find({ cross: req.params.cross }).sort({ area: 1, customerName: 1 });
    res.json(boxes);
  } catch (err) {
    console.error('[GET /jointboxes/cross/:cross]', err.message);
    res.status(500).json({ error: 'Failed to fetch joint boxes by cross.' });
  }
});

/**
 * GET /api/jointboxes/:id
 * Returns a single joint box by MongoDB _id.
 */
router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid ID format.' });
    }
    const box = await JointBox.findById(req.params.id);
    if (!box) {
      return res.status(404).json({ error: 'Joint box not found.' });
    }
    res.json(box);
  } catch (err) {
    console.error('[GET /jointboxes/:id]', err.message);
    res.status(500).json({ error: 'Failed to fetch joint box.' });
  }
});

/**
 * POST /api/jointboxes
 * Creates a new joint box. Requires authentication.
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const box = new JointBox(req.body);
    await box.save();
    res.status(201).json(box);
  } catch (err) {
    console.error('[POST /jointboxes]', err.message);
    if (err.code === 11000) {
      return res.status(409).json({ error: 'A joint box with this customerId already exists.' });
    }
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to create joint box.' });
  }
});

/**
 * PUT /api/jointboxes/:id
 * Updates an existing joint box by MongoDB _id. Requires authentication.
 */
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid ID format.' });
    }

    const box = await JointBox.findById(req.params.id);
    if (!box) {
      return res.status(404).json({ error: 'Joint box not found.' });
    }

    const { location, outputDbm, ...rest } = req.body;

    // Apply scalar field updates
    Object.assign(box, rest);

    // If outputDbm is explicitly provided (manual override), use it;
    // otherwise reset to null so the pre-save hook recalculates it
    box.outputDbm = outputDbm !== undefined ? outputDbm : null;

    // Use Mongoose set() for the nested location document — Object.assign
    // does not reliably trigger Mongoose's change detection on subdocuments
    box.set('location', location || { type: 'Point', coordinates: [0, 0] });

    await box.save();

    res.json(box);
  } catch (err) {
    console.error('[PUT /jointboxes/:id]', err.message);
    if (err.code === 11000) {
      return res.status(409).json({ error: 'A joint box with this customerId already exists.' });
    }
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to update joint box.' });
  }
});

/**
 * DELETE /api/jointboxes/:id
 * Deletes a joint box by MongoDB _id. Requires authentication.
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid ID format.' });
    }
    const box = await JointBox.findByIdAndDelete(req.params.id);
    if (!box) {
      return res.status(404).json({ error: 'Joint box not found.' });
    }
    res.json({ message: 'Joint box deleted successfully.', deletedId: req.params.id });
  } catch (err) {
    console.error('[DELETE /jointboxes/:id]', err.message);
    res.status(500).json({ error: 'Failed to delete joint box.' });
  }
});

module.exports = router;
