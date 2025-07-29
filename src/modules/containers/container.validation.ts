import { 
  ContainerConfig, 
  CreateContainerRequest, 
  PortMapping, 
  VolumeMapping, 
  ValidationResult,
  ValidationError 
} from '@/types/container.types';
import { 
  validateContainerConfig,
  validatePortMappings,
  validateVolumeMappings,
  validateNetworkConfiguration,
  validateResourceLimits,
  containerConfigSchema,
  createContainerRequestSchema
} from '@/utils/validation';

/**
 * Validates a complete container configuration
 */
export function validateCompleteContainerConfig(config: any): ValidationResult<ContainerConfig> {
  const result = validateContainerConfig<ContainerConfig>(containerConfigSchema, config);
  
  if (!result.isValid) {
    return result;
  }
  
  // Additional cross-field validation
  const additionalErrors: ValidationError[] = [];
  
  if (result.data) {
    // Validate port mappings for conflicts
    const portResult = validatePortMappings(result.data.ports);
    if (!portResult.isValid) {
      additionalErrors.push(...portResult.errors);
    }
    
    // Validate volume mappings for conflicts
    const volumeResult = validateVolumeMappings(result.data.volumes);
    if (!volumeResult.isValid) {
      additionalErrors.push(...volumeResult.errors);
    }
    
    // Validate network configuration
    const networkResult = validateNetworkConfiguration(result.data.networks);
    if (!networkResult.isValid) {
      additionalErrors.push(...networkResult.errors);
    }
    
    // Validate resource limits
    const resourceResult = validateResourceLimits(result.data.resources);
    if (!resourceResult.isValid) {
      additionalErrors.push(...resourceResult.errors);
    }
  }
  
  if (additionalErrors.length > 0) {
    return {
      isValid: false,
      errors: [...result.errors, ...additionalErrors]
    };
  }
  
  return result;
}

/**
 * Validates a container creation request
 */
export function validateCreateContainerRequest(request: any): ValidationResult<CreateContainerRequest> {
  const result = validateContainerConfig<CreateContainerRequest>(createContainerRequestSchema, request);
  
  if (!result.isValid) {
    return result;
  }
  
  // Additional validation for creation requests
  const additionalErrors: ValidationError[] = [];
  
  if (result.data) {
    // Validate port mappings for conflicts
    if (result.data.ports && result.data.ports.length > 0) {
      const portResult = validatePortMappings(result.data.ports);
      if (!portResult.isValid) {
        additionalErrors.push(...portResult.errors);
      }
    }
    
    // Validate volume mappings for conflicts
    if (result.data.volumes && result.data.volumes.length > 0) {
      const volumeResult = validateVolumeMappings(result.data.volumes);
      if (!volumeResult.isValid) {
        additionalErrors.push(...volumeResult.errors);
      }
    }
    
    // Validate network configuration
    if (result.data.networks && result.data.networks.length > 0) {
      const networkResult = validateNetworkConfiguration(result.data.networks);
      if (!networkResult.isValid) {
        additionalErrors.push(...networkResult.errors);
      }
    }
    
    // Validate resource limits
    if (result.data.resources) {
      const resourceResult = validateResourceLimits(result.data.resources);
      if (!resourceResult.isValid) {
        additionalErrors.push(...resourceResult.errors);
      }
    }
  }
  
  if (additionalErrors.length > 0) {
    return {
      isValid: false,
      errors: [...result.errors, ...additionalErrors]
    };
  }
  
  return result;
}

/**
 * Validates container name uniqueness (to be used with external container list)
 */
export function validateContainerNameUniqueness(
  name: string, 
  existingContainers: { name: string }[]
): ValidationResult<string> {
  const existingNames = existingContainers.map(c => c.name);
  
  if (existingNames.includes(name)) {
    return {
      isValid: false,
      errors: [{
        field: 'name',
        message: `Container name '${name}' is already in use`,
        value: name
      }]
    };
  }
  
  return {
    isValid: true,
    data: name,
    errors: []
  };
}

/**
 * Validates that required Docker image exists (placeholder for future implementation)
 */
export function validateDockerImage(image: string, tag: string = 'latest'): ValidationResult<string> {
  const fullImageName = `${image}:${tag}`;
  
  // Basic validation - in a real implementation, this would check if the image exists
  if (!image || image.trim() === '') {
    return {
      isValid: false,
      errors: [{
        field: 'image',
        message: 'Docker image name cannot be empty',
        value: image
      }]
    };
  }
  
  // Validate image name format (basic Docker image name validation)
  // Allow alphanumeric characters, dots, hyphens, underscores, slashes, and colons for registry URLs
  const imageNameRegex = /^[a-z0-9]+([\.\-_][a-z0-9]+)*(:[0-9]+)?(\/[a-z0-9]+([\.\-_][a-z0-9]+)*)*$/i;
  if (!imageNameRegex.test(image)) {
    return {
      isValid: false,
      errors: [{
        field: 'image',
        message: 'Invalid Docker image name format',
        value: image
      }]
    };
  }
  
  return {
    isValid: true,
    data: fullImageName,
    errors: []
  };
}

/**
 * Validates host path accessibility (placeholder for future implementation)
 */
export function validateHostPath(hostPath: string): ValidationResult<string> {
  if (!hostPath || hostPath.trim() === '') {
    return {
      isValid: false,
      errors: [{
        field: 'hostPath',
        message: 'Host path cannot be empty',
        value: hostPath
      }]
    };
  }
  
  // Basic path validation - in a real implementation, this would check if the path exists and is accessible
  if (!hostPath.startsWith('/') && !hostPath.match(/^[A-Za-z]:\\/)) {
    return {
      isValid: false,
      errors: [{
        field: 'hostPath',
        message: 'Host path must be an absolute path',
        value: hostPath
      }]
    };
  }
  
  return {
    isValid: true,
    data: hostPath,
    errors: []
  };
}

/**
 * Validates port availability on host (placeholder for future implementation)
 */
export function validatePortAvailability(port: number): ValidationResult<number> {
  // Basic port range validation
  if (port < 1 || port > 65535) {
    return {
      isValid: false,
      errors: [{
        field: 'port',
        message: 'Port must be between 1 and 65535',
        value: port
      }]
    };
  }
  
  // Reserved ports check
  const reservedPorts = [22, 80, 443, 3306, 5432]; // Common reserved ports
  if (reservedPorts.includes(port)) {
    return {
      isValid: false,
      errors: [{
        field: 'port',
        message: `Port ${port} is commonly reserved and may cause conflicts`,
        value: port
      }]
    };
  }
  
  return {
    isValid: true,
    data: port,
    errors: []
  };
}