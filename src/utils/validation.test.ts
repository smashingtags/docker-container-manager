import {
  validatePortMappings,
  validateVolumeMappings,
  validateNetworkConfiguration,
  validatePortConfiguration,
  validateVolumeConfiguration,
  validateNetworkCompatibility
} from './validation';
import { PortMapping, VolumeMapping } from '@/types/container.types';

describe('Validation Utils', () => {
  describe('validatePortMappings', () => {
    it('should validate valid port mappings', () => {
      const ports: PortMapping[] = [
        { hostPort: 8080, containerPort: 80, protocol: 'tcp' },
        { hostPort: 8443, containerPort: 443, protocol: 'tcp' }
      ];

      const result = validatePortMappings(ports);

      expect(result.isValid).toBe(true);
      expect(result.data).toEqual(ports);
    });

    it('should detect duplicate host ports', () => {
      const ports: PortMapping[] = [
        { hostPort: 8080, containerPort: 80, protocol: 'tcp' },
        { hostPort: 8080, containerPort: 443, protocol: 'tcp' }
      ];

      const result = validatePortMappings(ports);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.message).toContain('already in use');
    });

    it('should validate port ranges', () => {
      const ports: PortMapping[] = [
        { hostPort: 0, containerPort: 80, protocol: 'tcp' },
        { hostPort: 70000, containerPort: 443, protocol: 'tcp' }
      ];

      const result = validatePortMappings(ports);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.message.includes('between 1 and 65535'))).toBe(true);
    });

    it('should warn about reserved ports', () => {
      const ports: PortMapping[] = [
        { hostPort: 22, containerPort: 80, protocol: 'tcp' },
        { hostPort: 443, containerPort: 443, protocol: 'tcp' }
      ];

      const result = validatePortMappings(ports);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.message.includes('reserved'))).toBe(true);
    });

    it('should validate protocol values', () => {
      const ports = [
        { hostPort: 8080, containerPort: 80, protocol: 'invalid' }
      ];

      const result = validatePortMappings(ports as any);

      expect(result.isValid).toBe(false);
    });
  });

  describe('validateVolumeMappings', () => {
    it('should validate valid volume mappings', () => {
      const volumes: VolumeMapping[] = [
        { hostPath: '/host/data', containerPath: '/app/data', mode: 'rw' },
        { hostPath: '/host/config', containerPath: '/app/config', mode: 'ro' }
      ];

      const result = validateVolumeMappings(volumes);

      expect(result.isValid).toBe(true);
      expect(result.data).toEqual(volumes);
    });

    it('should detect duplicate container paths', () => {
      const volumes: VolumeMapping[] = [
        { hostPath: '/host/data1', containerPath: '/app/data', mode: 'rw' },
        { hostPath: '/host/data2', containerPath: '/app/data', mode: 'ro' }
      ];

      const result = validateVolumeMappings(volumes);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.message).toContain('already mapped');
    });

    it('should warn about duplicate host paths', () => {
      const volumes: VolumeMapping[] = [
        { hostPath: '/host/data', containerPath: '/app/data1', mode: 'rw' },
        { hostPath: '/host/data', containerPath: '/app/data2', mode: 'ro' }
      ];

      const result = validateVolumeMappings(volumes);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.message.includes('mapped multiple times'))).toBe(true);
    });

    it('should validate path formats', () => {
      const volumes: VolumeMapping[] = [
        { hostPath: 'relative/path', containerPath: '/app/data', mode: 'rw' },
        { hostPath: '/host/data', containerPath: 'relative/container', mode: 'rw' }
      ];

      const result = validateVolumeMappings(volumes);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.message.includes('absolute path'))).toBe(true);
    });

    it('should warn about dangerous host paths', () => {
      const volumes: VolumeMapping[] = [
        { hostPath: '/etc', containerPath: '/app/etc', mode: 'rw' },
        { hostPath: '/var/log', containerPath: '/app/logs', mode: 'rw' }
      ];

      const result = validateVolumeMappings(volumes);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.message.includes('dangerous'))).toBe(true);
    });

    it('should validate mode values', () => {
      const volumes = [
        { hostPath: '/host/data', containerPath: '/app/data', mode: 'invalid' }
      ];

      const result = validateVolumeMappings(volumes as any);

      expect(result.isValid).toBe(false);
    });
  });

  describe('validateNetworkConfiguration', () => {
    it('should validate valid network configuration', () => {
      const networks = ['bridge', 'custom-network'];

      const result = validateNetworkConfiguration(networks);

      expect(result.isValid).toBe(true);
      expect(result.data).toEqual(networks);
    });

    it('should detect duplicate network names', () => {
      const networks = ['bridge', 'bridge'];

      const result = validateNetworkConfiguration(networks);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.message).toContain('Duplicate network names');
    });

    it('should validate network name formats', () => {
      const networks = ['invalid-network!', '123-invalid', 'valid_network'];

      const result = validateNetworkConfiguration(networks);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.message.includes('invalid characters'))).toBe(true);
    });

    it('should detect reserved network names', () => {
      const networks = ['none', 'host', 'container'];

      const result = validateNetworkConfiguration(networks);

      expect(result.isValid).toBe(false);
      expect(result.errors.every(e => e.message.includes('reserved'))).toBe(true);
    });

    it('should handle non-array input', () => {
      const result = validateNetworkConfiguration('not-an-array' as any);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]?.message).toContain('must be an array');
    });

    it('should handle empty and invalid network names', () => {
      const networks = ['', null, undefined, 123] as any;

      const result = validateNetworkConfiguration(networks);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.message.includes('non-empty string'))).toBe(true);
    });
  });

  describe('validatePortConfiguration', () => {
    it('should validate ports without conflicts', () => {
      const ports: PortMapping[] = [
        { hostPort: 8080, containerPort: 80, protocol: 'tcp' }
      ];
      const existingPorts = [3000, 5000];

      const result = validatePortConfiguration(ports, existingPorts);

      expect(result.isValid).toBe(true);
    });

    it('should detect conflicts with existing ports', () => {
      const ports: PortMapping[] = [
        { hostPort: 3000, containerPort: 80, protocol: 'tcp' }
      ];
      const existingPorts = [3000, 5000];

      const result = validatePortConfiguration(ports, existingPorts);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.message.includes('already in use by another'))).toBe(true);
    });

    it('should work without existing ports list', () => {
      const ports: PortMapping[] = [
        { hostPort: 8080, containerPort: 80, protocol: 'tcp' }
      ];

      const result = validatePortConfiguration(ports);

      expect(result.isValid).toBe(true);
    });
  });

  describe('validateVolumeConfiguration', () => {
    it('should validate volumes without path checks', () => {
      const volumes: VolumeMapping[] = [
        { hostPath: '/host/data', containerPath: '/app/data', mode: 'rw' }
      ];

      const result = validateVolumeConfiguration(volumes, false);

      expect(result.isValid).toBe(true);
    });

    it('should detect relative path components when checking paths', () => {
      const volumes: VolumeMapping[] = [
        { hostPath: '/host/../data', containerPath: '/app/data', mode: 'rw' },
        { hostPath: '/host/./data', containerPath: '/app/data2', mode: 'rw' }
      ];

      const result = validateVolumeConfiguration(volumes, true);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.message.includes('relative path components'))).toBe(true);
    });

    it('should detect empty paths when checking paths', () => {
      const volumes: VolumeMapping[] = [
        { hostPath: '', containerPath: '/app/data', mode: 'rw' },
        { hostPath: '/host/data', containerPath: '   ', mode: 'rw' }
      ];

      const result = validateVolumeConfiguration(volumes, true);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.message.includes('cannot be empty'))).toBe(true);
    });
  });

  describe('validateNetworkCompatibility', () => {
    it('should validate networks against available list', () => {
      const networks = ['bridge', 'custom-network'];
      const availableNetworks = ['bridge', 'host', 'custom-network'];

      const result = validateNetworkCompatibility(networks, availableNetworks);

      expect(result.isValid).toBe(true);
    });

    it('should allow built-in networks even if not in available list', () => {
      const networks = ['bridge', 'host', 'none'];
      const availableNetworks = ['custom-network'];

      const result = validateNetworkCompatibility(networks, availableNetworks);

      expect(result.isValid).toBe(true);
    });

    it('should detect non-existent networks', () => {
      const networks = ['bridge', 'nonexistent-network'];
      const availableNetworks = ['bridge', 'host'];

      const result = validateNetworkCompatibility(networks, availableNetworks);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.message.includes('does not exist'))).toBe(true);
    });

    it('should work without available networks list', () => {
      const networks = ['bridge', 'custom-network'];

      const result = validateNetworkCompatibility(networks);

      expect(result.isValid).toBe(true);
    });
  });
});