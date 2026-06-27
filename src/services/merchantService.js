const prisma = require('../config/prisma');
const bcrypt = require('bcryptjs');
const { generateMerchantId, generatePosId, generateActivationCode } = require('../utils/helpers');
const logger = require('../utils/logger');

class MerchantService {
  static async registerMerchant(data) {
    try {
      const hashedPassword = await bcrypt.hash(data.password, 10);
      const merchantId = generateMerchantId();
      const merchant = await prisma.merchant.create({
        data: {
          merchantId,
          name: data.name,
          email: data.email,
          phone: data.phone,
          businessName: data.businessName,
          address: data.address,
          country: data.country,
          password: hashedPassword,
          status: 'active'
        }
      });
      return merchant;
    } catch (error) {
      logger.error('Failed to register merchant', { error: error.message });
      throw error;
    }
  }

  static async createPOSDevice(merchantId, deviceModel, deviceSerial) {
    let lastError;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const posId = generatePosId();
        const activationCode = generateActivationCode();
        const posDevice = await prisma.pOSDevice.create({
          data: {
            posId,
            merchantId,
            activationCode,
            deviceModel,
            deviceSerial,
            status: 'pending'
          }
        });
        return posDevice;
      } catch (error) {
        lastError = error;
        const isUniqueConstraintError = error?.code === 'P2002' || /Unique constraint failed|Unique.*constraint/i.test(error?.message || '');
        if (!isUniqueConstraintError || attempt === 4) {
          logger.error('Failed to create POS device', { error: error.message });
          throw error;
        }
      }
    }

    throw lastError;
  }

  static async activatePOSDevice(posId, activationCode) {
    try {
      const posDevice = await prisma.pOSDevice.findUnique({
        where: { posId }
      });

      if (!posDevice || posDevice.activationCode !== activationCode) {
        throw new Error('Invalid POS device or activation code');
      }

      if (posDevice.status === 'active') {
        throw new Error('POS device already activated');
      }

      const updated = await prisma.pOSDevice.update({
        where: { id: posDevice.id },
        data: {
          status: 'active',
          lastSeenAt: new Date()
        }
      });

      return updated;
    } catch (error) {
      logger.error('Failed to activate POS device', { error: error.message });
      throw error;
    }
  }
}

module.exports = MerchantService;
