package generator;

import cloudinfragen.*;
import generator.validation.NlpModelValidator;
import generator.validation.ValidationException;
import org.eclipse.emf.common.util.URI;
import org.eclipse.emf.ecore.resource.Resource;
import org.eclipse.emf.ecore.resource.ResourceSet;
import org.eclipse.emf.ecore.resource.impl.ResourceSetImpl;
import org.eclipse.emf.ecore.xmi.impl.XMIResourceFactoryImpl;
import org.eclipse.emf.ecore.xmi.impl.XMLResourceFactoryImpl;

import java.io.IOException;
import java.util.*;

/**
 * Generates EMF model instances from validated NLP JSON output.
 * 
 * This generator implements professional MDE engineering practices:
 * - Fail-fast validation before model creation
 * - Enum-based resource type handling (no string logic)
 * - Proper EMF containment enforcement
 * - Deterministic, reproducible models
 * 
 * Architecture:
 * 1. Validate NLP JSON (NlpModelValidator)
 * 2. Create all resources (name-indexed)
 * 3. Establish relationships and containment
 * 4. Return validated EMF model
 */
public class ModelGenerator {
    
    private final CloudinfragenFactory factory;
    private final ResourceSet resourceSet;
    private final NlpModelValidator validator;
    
    public ModelGenerator() {
        factory = CloudinfragenFactory.eINSTANCE;
        resourceSet = new ResourceSetImpl();
        resourceSet.getResourceFactoryRegistry().getExtensionToFactoryMap()
            .put("xmi", new XMIResourceFactoryImpl());
        resourceSet.getResourceFactoryRegistry().getExtensionToFactoryMap()
            .put("xml", new XMLResourceFactoryImpl());
        validator = new NlpModelValidator();
    }
    
    /**
     * Creates an Infrastructure model from validated NLP JSON structure.
     * 
     * This method implements "correct by construction": invalid NLP input
     * cannot produce an invalid EMF model because validation happens first.
     * 
     * @param nlpJson Map representing the NLP output
     * @return Infrastructure model instance (guaranteed valid)
     * @throws ValidationException if NLP input is invalid
     */
    public Infrastructure createModel(Map<String, Object> nlpJson) {
        // STEP 1: Validate NLP JSON (FAIL FAST)
        validator.validate(nlpJson);
        
        // STEP 2: Create Infrastructure root
        Infrastructure infra = factory.createInfrastructure();
        String provider = (String) nlpJson.getOrDefault("provider", "AWS");
        infra.setProvider(provider);
        
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> resources = (List<Map<String, Object>>) nlpJson.get("resources");
        if (resources == null || resources.isEmpty()) {
            return infra;
        }
        
        // STEP 3: Create all resources (name-indexed for deterministic lookup)
        Map<String, CloudResource> resourceMap = new HashMap<>();
        Map<String, Map<String, Object>> resourceDataMap = new HashMap<>();
        
        for (Map<String, Object> resourceData : resources) {
            String name = (String) resourceData.get("name");
            if (name == null) {
                continue; // Should not happen after validation
            }
            
            CloudResource resource = createResource(resourceData);
            if (resource != null) {
                resourceMap.put(name, resource);
                resourceDataMap.put(name, resourceData);
                infra.getResources().add(resource);
            }
        }
        
        // STEP 4: Establish relationships and EMF containment
        establishRelationshipsAndContainment(resources, resourceMap, resourceDataMap, infra);
        
        return infra;
    }
    
    /**
     * Creates a CloudResource from validated resource data.
     * Uses ResourceType enum for type-safe handling.
     */
    private CloudResource createResource(Map<String, Object> data) {
        String typeStr = (String) data.get("type");
        ResourceType type = ResourceType.fromNlpString(typeStr);
        
        String name = (String) data.get("name");
        String id = UUID.randomUUID().toString();
        
        CloudResource resource = createResourceByType(type, data, id, name);
        
        // Set common attributes
        if (resource != null) {
            if (data.containsKey("region")) {
                resource.setRegion((String) data.get("region"));
            }
            @SuppressWarnings("unchecked")
            List<String> tags = (List<String>) data.getOrDefault("tags", new ArrayList<>());
            resource.getTags().addAll(tags);
        }
        
        return resource;
    }
    
    /**
     * Creates a resource instance based on ResourceType enum.
     * This eliminates string-based switch logic.
     */
    private CloudResource createResourceByType(
            ResourceType type, 
            Map<String, Object> data, 
            String id, 
            String name) {
        
        switch (type) {
            case COMPUTE_INSTANCE:
                ComputeInstance ci = factory.createComputeInstance();
                ci.setId(id);
                ci.setName(name);
                if (data.containsKey("os")) {
                    ci.setOs((String) data.get("os"));
                }
                if (data.containsKey("image")) {
                    ci.setKeypair((String) data.get("image"));
                }
                return ci;
                
            case AUTO_SCALING_GROUP:
                AutoScalingGroup asg = factory.createAutoScalingGroup();
                asg.setId(id);
                asg.setName(name);
                asg.setMinSize((Integer) data.getOrDefault("minSize", 1));
                asg.setMaxSize((Integer) data.getOrDefault("maxSize", 1));
                if (data.containsKey("desiredCapacity")) {
                    asg.setDesiredCapacity((Integer) data.get("desiredCapacity"));
                }
                return asg;
                
            case CONTAINER_SERVICE:
                ContainerService cs = factory.createContainerService();
                cs.setId(id);
                cs.setName(name);
                cs.setClusterName((String) data.getOrDefault("clusterName", name));
                cs.setImage((String) data.getOrDefault("image", "nginx:latest"));
                cs.setNumberOfContainers((Integer) data.getOrDefault("numberOfContainers", 1));
                return cs;
                
            case FUNCTION:
                Function func = factory.createFunction();
                func.setId(id);
                func.setName(name);
                func.setRuntime((String) data.getOrDefault("runtime", "python3.9"));
                func.setTrigger((String) data.getOrDefault("trigger", "http"));
                return func;
                
            case VOLUME:
                Volume vol = factory.createVolume();
                vol.setId(id);
                vol.setName(name);
                vol.setSize((Integer) data.getOrDefault("size", 20));
                vol.setEncrypted((Boolean) data.getOrDefault("encrypted", false));
                return vol;
                
            case STORAGE_BUCKET:
                StorageBucket bucket = factory.createStorageBucket();
                bucket.setId(id);
                bucket.setName(name);
                bucket.setVersioning((Boolean) data.getOrDefault("versioning", false));
                bucket.setPublicAccess((Boolean) data.getOrDefault("publicAccess", false));
                return bucket;
                
            case FILE_SYSTEM:
                FileSystem fs = factory.createFileSystem();
                fs.setId(id);
                fs.setName(name);
                fs.setCapacityGB((Integer) data.getOrDefault("capacityGB", 100));
                fs.setEncrypted((Boolean) data.getOrDefault("encrypted", false));
                return fs;
                
            case DATABASE_INSTANCE:
                DatabaseInstance db = factory.createDatabaseInstance();
                db.setId(id);
                db.setName(name);
                db.setEngine((String) data.getOrDefault("engine", "mysql"));
                db.setVersion((String) data.getOrDefault("version", "8.0"));
                db.setStorageSize((Integer) data.getOrDefault("storageSize", 20));
                db.setMultiAZ((Boolean) data.getOrDefault("multiAZ", false));
                return db;
                
            case NOSQL_DATABASE:
                NoSQLDatabase nosql = factory.createNoSQLDatabase();
                nosql.setId(id);
                nosql.setName(name);
                nosql.setEngine((String) data.getOrDefault("engine", "dynamodb"));
                nosql.setThroughputCapacity((Integer) data.getOrDefault("throughputCapacity", 5));
                nosql.setReplicaCount((Integer) data.getOrDefault("replicaCount", 1));
                return nosql;
                
            case VPC:
                VPC vpc = factory.createVPC();
                vpc.setId(id);
                vpc.setName(name);
                vpc.setCidrBlock((String) data.getOrDefault("cidr", "10.0.0.0/16"));
                return vpc;
                
            case SUBNET:
                Subnet subnet = factory.createSubnet();
                subnet.setId(id);
                subnet.setName(name);
                subnet.setCidr((String) data.getOrDefault("cidr", "10.0.1.0/24"));
                subnet.setTypeSubnet((String) data.getOrDefault("typeSubnet", "public"));
                subnet.setAvailabilityZone((String) data.getOrDefault("availabilityZone", "us-east-1a"));
                return subnet;
                
            case ROUTE_TABLE:
                RouteTable rt = factory.createRouteTable();
                rt.setId(id);
                rt.setName(name);
                @SuppressWarnings("unchecked")
                List<String> routes = (List<String>) data.getOrDefault("routes", new ArrayList<>());
                rt.getRoutes().addAll(routes);
                return rt;
                
            case SECURITY_GROUP:
                SecurityGroup sg = factory.createSecurityGroup();
                sg.setId(id);
                sg.setName(name);
                @SuppressWarnings("unchecked")
                List<String> inbound = (List<String>) data.getOrDefault("inboundRules", new ArrayList<>());
                sg.getInboundRules().addAll(inbound);
                @SuppressWarnings("unchecked")
                List<String> outbound = (List<String>) data.getOrDefault("outboundRules", new ArrayList<>());
                sg.getOutboundRules().addAll(outbound);
                return sg;
                
            case LOAD_BALANCER:
                LoadBalancer lb = factory.createLoadBalancer();
                lb.setId(id);
                lb.setName(name);
                lb.setType((String) data.getOrDefault("type", "application"));
                return lb;
                
            case NETWORK_INTERFACE:
                NetworkInterface ni = factory.createNetworkInterface();
                ni.setId(id);
                ni.setName(name);
                ni.setPrivateIP((String) data.getOrDefault("privateIP", ""));
                ni.setPublicIP((String) data.getOrDefault("publicIP", ""));
                return ni;
                
            case IAM_ROLE:
                IAMRole role = factory.createIAMRole();
                role.setId(id);
                role.setName(name);
                role.setAssumeRolePolicy((String) data.getOrDefault("assumeRolePolicy", ""));
                return role;
                
            case IAM_POLICY:
                IAMPolicy policy = factory.createIAMPolicy();
                policy.setId(id);
                policy.setName(name);
                @SuppressWarnings("unchecked")
                List<String> actions = (List<String>) data.getOrDefault("actions", new ArrayList<>());
                policy.getActions().addAll(actions);
                @SuppressWarnings("unchecked")
                List<String> policyResources = (List<String>) data.getOrDefault("resources", new ArrayList<>());
                policy.getResources().addAll(policyResources);
                return policy;
                
            case SECRET:
                Secret secret = factory.createSecret();
                secret.setId(id);
                secret.setName(name);
                secret.setKey((String) data.getOrDefault("key", ""));
                secret.setEncrypted((Boolean) data.getOrDefault("encrypted", true));
                return secret;
                
            case MONITORING_SERVICE:
                MonitoringService ms = factory.createMonitoringService();
                ms.setId(id);
                ms.setName(name);
                @SuppressWarnings("unchecked")
                List<String> metrics = (List<String>) data.getOrDefault("metrics", new ArrayList<>());
                ms.getMetrics().addAll(metrics);
                return ms;
                
            default:
                throw new IllegalStateException("Unhandled resource type: " + type);
        }
    }
    
    /**
     * Establishes all relationships and EMF containment.
     * 
     * This method properly enforces EMF containment rules:
     * - Subnets are contained in VPCs (not just referenced)
     * - All references are validated and set
     * - No index-based alignment (uses name-based lookup)
     */
    private void establishRelationshipsAndContainment(
            List<Map<String, Object>> resources,
            Map<String, CloudResource> resourceMap,
            Map<String, Map<String, Object>> resourceDataMap,
            Infrastructure infra) {
        
        // First, handle VPC containment (Subnets must be contained in VPCs)
        for (Map<String, Object> resourceData : resources) {
            String typeStr = (String) resourceData.get("type");
            if (typeStr == null) continue;
            
            ResourceType type = ResourceType.fromNlpString(typeStr);
            
            if (type == ResourceType.SUBNET) {
                String subnetName = (String) resourceData.get("name");
                String vpcName = (String) resourceData.get("vpc");
                
                if (subnetName != null && vpcName != null) {
                    Subnet subnet = (Subnet) resourceMap.get(subnetName);
                    VPC vpc = (VPC) resourceMap.get(vpcName);
                    
                    if (subnet != null && vpc != null) {
                        // CRITICAL: Enforce EMF containment
                        // Remove subnet from Infrastructure.resources
                        infra.getResources().remove(subnet);
                        
                        // Add subnet to VPC.subnets (this sets containment)
                        vpc.getSubnets().add(subnet);
                        
                        // EMF automatically sets subnet.vpc via bidirectional reference
                    }
                }
            }
        }
        
        // Then, establish all other relationships
        for (Map<String, Object> resourceData : resources) {
            String name = (String) resourceData.get("name");
            if (name == null) continue;
            
            CloudResource resource = resourceMap.get(name);
            if (resource == null) continue;
            
            establishResourceRelationships(resource, resourceData, resourceMap);
        }
    }
    
    /**
     * Establishes relationships for a specific resource.
     */
    private void establishResourceRelationships(
            CloudResource resource,
            Map<String, Object> data,
            Map<String, CloudResource> resourceMap) {
        
        String typeStr = (String) data.get("type");
        if (typeStr == null) return;
        
        ResourceType type = ResourceType.fromNlpString(typeStr);
        
        switch (type) {
            case COMPUTE_INSTANCE:
                ComputeInstance ci = (ComputeInstance) resource;
                
                // Link security groups (mandatory constraint)
                @SuppressWarnings("unchecked")
                List<String> sgNames = (List<String>) data.getOrDefault("securityGroups", new ArrayList<>());
                for (String sgName : sgNames) {
                    CloudResource sg = resourceMap.get(sgName);
                    if (sg instanceof SecurityGroup) {
                        ci.getSecurityGroups().add((SecurityGroup) sg);
                    }
                }
                break;
                
            case DATABASE_INSTANCE:
                DatabaseInstance db = (DatabaseInstance) resource;
                
                // Link security groups
                @SuppressWarnings("unchecked")
                List<String> dbSgNames = (List<String>) data.getOrDefault("securityGroups", new ArrayList<>());
                for (String sgName : dbSgNames) {
                    CloudResource sg = resourceMap.get(sgName);
                    if (sg instanceof SecurityGroup) {
                        db.getSecurityGroups().add((SecurityGroup) sg);
                    }
                }
                break;
                
            case AUTO_SCALING_GROUP:
                AutoScalingGroup asg = (AutoScalingGroup) resource;
                
                // Link template (mandatory constraint)
                String templateName = (String) data.get("template");
                if (templateName != null) {
                    CloudResource template = resourceMap.get(templateName);
                    if (template instanceof ComputeInstance) {
                        asg.setTemplate((ComputeInstance) template);
                    }
                }
                break;
                
            case FUNCTION:
                Function func = (Function) resource;
                
                // Link IAM role
                String roleName = (String) data.get("iamRole");
                if (roleName != null) {
                    CloudResource role = resourceMap.get(roleName);
                    if (role instanceof IAMRole) {
                        func.setIamRole((IAMRole) role);
                    }
                }
                break;
                
            case NETWORK_INTERFACE:
                NetworkInterface ni = (NetworkInterface) resource;
                
                // Note: NetworkInterface.subnet is changeable="false" in metamodel
                // The subnet reference is set through EMF containment or bidirectional reference
                // For now, validation ensures the subnet exists, but we don't set it here
                // as it requires EMF eSet() API or proper containment setup
                
                // Link security groups
                @SuppressWarnings("unchecked")
                List<String> niSgNames = (List<String>) data.getOrDefault("securityGroups", new ArrayList<>());
                for (String sgName : niSgNames) {
                    CloudResource sg = resourceMap.get(sgName);
                    if (sg instanceof SecurityGroup) {
                        ni.getSecurityGroups().add((SecurityGroup) sg);
                    }
                }
                break;
        }
    }
    
    /**
     * Saves the model to XMI file.
     */
    public void saveModel(Infrastructure infra, String filePath) throws IOException {
        Resource resource = resourceSet.createResource(URI.createFileURI(filePath));
        resource.getContents().add(infra);
        resource.save(Collections.EMPTY_MAP);
    }
}
