const mongoose = require('mongoose');

const BASE_LOSSES = { '1x4': 7, '1x8': 12, '50x50': 3.5, 'joint_only': 0.02 };
const BASE_PORTS  = { '1x4': 4, '1x8': 8,  '50x50': 2,   'joint_only': 1 };

function calculateOutputDbm(inputDbm, couplerType) {
  if (!couplerType) return inputDbm;
  const loss = couplerType.split('+').reduce((s, p) => s + (BASE_LOSSES[p] || 0), 0);
  return inputDbm - loss;
}

function getTotalPorts(couplerType) {
  if (!couplerType) return 1;
  return couplerType.split('+').reduce((prod, p) => prod * (BASE_PORTS[p] || 1), 1);
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
    fiberType: [{ type: String }],
    coreNo: { type: mongoose.Schema.Types.Mixed, default: [] },
    outputFiberType: [{ type: String }],
    outputCoreNo: { type: mongoose.Schema.Types.Mixed, default: [] },
    couplerStages: [{
      couplerType: { type: String },
      coreUsed: [{ type: Number }],
      coreThroughed: [{ type: Number }],
      forwardsTo: [{ type: String }]
    }],
    couplerType: { type: String, required: true },
    inputDbm: { type: Number, required: true },
    outputDbm: { type: Number },           // auto-calculated, stored
    totalPorts: { type: Number },          // auto-calculated
    coreUsed: [{ type: Number }],
    coreThroughed: [{ type: Number }],
    portsUsed: { type: Number, default: 0 },
    extraPorts: { type: Number },
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
  if (this.couplerStages?.length > 0) {
    const first = this.couplerStages[0];
    if (first.couplerType) this.couplerType = first.couplerType;
    this.coreUsed = first.coreUsed || [];
    this.coreThroughed = first.coreThroughed || [];
    this.forwardsTo = [...new Set(this.couplerStages.flatMap(s => s.forwardsTo || []))];
  }
  this.totalPorts = getTotalPorts(this.couplerType);
  if (this.outputDbm == null) {
    this.outputDbm = calculateOutputDbm(this.inputDbm, this.couplerType);
  }
  this.portsUsed = (this.coreUsed || []).length;
  this.extraPorts = Math.max(0, this.totalPorts - this.portsUsed);
  next();
});

// Pre-findOneAndUpdate hook: recalculate when updating via findOneAndUpdate
// If outputDbm is explicitly included in the update payload, use it as-is.
jointBoxSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate();
  const inputDbm = update.inputDbm !== undefined ? update.inputDbm : null;
  const couplerType = update.couplerType !== undefined ? update.couplerType : null;

  if (inputDbm !== null && couplerType !== null) {
    if (update.outputDbm === undefined) {
      update.outputDbm = calculateOutputDbm(inputDbm, couplerType);
    }
    update.totalPorts = getTotalPorts(couplerType);
  }
  if (update.coreUsed !== undefined) {
    update.portsUsed = (update.coreUsed || []).length;
    if (update.totalPorts != null) {
      update.extraPorts = Math.max(0, update.totalPorts - update.portsUsed);
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
