const mongoose = require('mongoose');

/**
 * Calculate output dBm based on input dBm and coupler type.
 * Each coupler type introduces a known insertion loss.
 */
function calculateOutputDbm(inputDbm, couplerType) {
  const losses = {
    '1x4': 7,
    '1x8': 10,
    '50x50': 3,
    '1x4+1x8': 17,
    '50x50+50x50': 6,
    'joint_only': 0.5
  };
  return inputDbm - (losses[couplerType] || 0);
}

/**
 * Get total output ports for a given coupler type.
 */
function getTotalPorts(couplerType) {
  const ports = {
    '1x4': 4,
    '1x8': 8,
    '50x50': 2,
    '1x4+1x8': 32,
    '50x50+50x50': 3,
    'joint_only': 1
  };
  return ports[couplerType] || 1;
}

const jointBoxSchema = new mongoose.Schema(
  {
    customerId: { type: String, required: true, unique: true },
    customerName: { type: String },
    doorNo: { type: String },
    area: {
      type: String,
      required: true,
      enum: ['Medarakeri', 'Bandikeri']
    },
    cross: { type: String, required: true },
    edgaPortNo: { type: String },
    fiberType: {
      type: String,
      enum: ['12F', '6F', '']
    },
    coreNo: { type: Number },
    couplerType: {
      type: String,
      required: true,
      enum: ['1x4', '1x8', '50x50', '1x4+1x8', '50x50+50x50', 'joint_only']
    },
    inputDbm: { type: Number, required: true },
    outputDbm: { type: Number },           // auto-calculated, stored
    totalPorts: { type: Number },          // auto-calculated
    portsUsed: { type: Number, default: 0 },
    extraPorts: { type: Number },          // auto-calculated
    forwardsTo: [{ type: String }],        // array of customerIds
    notes: { type: String, default: '' },
    photos: [{ type: String }],
    voiceNote: { type: String, default: '' },
    location: {
      type: { type: String, default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] }
    }
  },
  {
    timestamps: true
  }
);

// Pre-save hook: auto-calculate outputDbm, totalPorts, extraPorts
// If outputDbm was explicitly set in the payload, respect it (manual override).
jointBoxSchema.pre('save', function (next) {
  this.totalPorts = getTotalPorts(this.couplerType);
  if (this.outputDbm == null) {
    this.outputDbm = calculateOutputDbm(this.inputDbm, this.couplerType);
  }
  this.extraPorts = Math.max(0, this.totalPorts - (this.portsUsed || 0));
  next();
});

// Pre-findOneAndUpdate hook: recalculate when updating via findOneAndUpdate
// If outputDbm is explicitly included in the update payload, use it as-is.
jointBoxSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate();
  const inputDbm = update.inputDbm !== undefined ? update.inputDbm : null;
  const couplerType = update.couplerType !== undefined ? update.couplerType : null;
  const portsUsed = update.portsUsed !== undefined ? update.portsUsed : null;

  if (inputDbm !== null && couplerType !== null) {
    if (update.outputDbm === undefined) {
      update.outputDbm = calculateOutputDbm(inputDbm, couplerType);
    }
    update.totalPorts = getTotalPorts(couplerType);
    if (portsUsed !== null) {
      update.extraPorts = Math.max(0, update.totalPorts - portsUsed);
    }
  }
  next();
});

// 2dsphere index for geospatial queries
jointBoxSchema.index({ location: '2dsphere' });

// Compound index for area + cross queries
jointBoxSchema.index({ area: 1, cross: 1 });

const JointBox = mongoose.model('JointBox', jointBoxSchema);

module.exports = JointBox;
